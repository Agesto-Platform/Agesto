import { http, HttpResponse } from 'msw'
import type {
  Orcamento,
  ItemOrcamento,
  ItemOrcamentoInput,
  OrcamentoInput,
  StatusOrcamento,
} from '../../types/api'
import { ok, fail } from '../lib/http'
import { clienteStore } from './clientes'
import { produtoStore } from './produtos'
import { servicoStore } from './servicos'

/** PAG-01: cliente e nomes dos itens vêm no orçamento, como na API. */
function comNomes(o: Orcamento): Orcamento {
  return {
    ...o,
    clienteNome: clienteStore.get(o.clienteId)?.nome ?? null,
    clienteTelefone: clienteStore.get(o.clienteId)?.telefone ?? null,
    itens: o.itens.map((i) => {
      const s = i.servicoId != null ? servicoStore.get(i.servicoId) : undefined
      return {
        ...i,
        produtoNome: i.produtoId != null ? produtoStore.get(i.produtoId)?.nome ?? null : null,
        servicoDescricao: s?.descricao ?? null,
        tipoCobranca: s?.tipoCobranca ?? null,
      }
    }),
  }
}

const sem = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

let nextId = 1
let nextItemId = 1
let nextAtendId = 500

function buildItens(itens: ItemOrcamentoInput[]): ItemOrcamento[] {
  return itens.map((it) => ({
    id: nextItemId++,
    produtoId: it.produtoId ?? null,
    servicoId: it.servicoId ?? null,
    descricao: it.descricao ?? null,
    quantidade: it.quantidade,
    precoUnitario: it.precoUnitario,
    subtotal: it.quantidade * it.precoUnitario,
    custo: it.custo ?? null,
  }))
}

function makeOrcamento(body: OrcamentoInput): Orcamento {
  const itens = buildItens(body.itens)
  const now = new Date().toISOString()
  return {
    id: nextId++,
    uuid: crypto.randomUUID(),
    clienteId: body.clienteId,
    status: body.status ?? 'Rascunho',
    valorTotal: itens.reduce((s, i) => s + i.subtotal, 0),
    dataRegistro: now,
    atendimentoConvertidoId: null,
    createdAt: now,
    updatedAt: now,
    itens,
  }
}

let orcamentos: Orcamento[] = [
  makeOrcamento({
    clienteId: 1,
    status: 'Enviado',
    itens: [
      { servicoId: 1, quantidade: 1, precoUnitario: 350 },
      { produtoId: 1, quantidade: 2, precoUnitario: 70 },
    ],
  }),
  makeOrcamento({
    clienteId: 2,
    status: 'Aprovado',
    itens: [{ servicoId: 2, quantidade: 3, precoUnitario: 140 }],
  }),
  makeOrcamento({
    clienteId: 3,
    status: 'Rascunho',
    itens: [{ descricao: 'Vistoria técnica', quantidade: 1, precoUnitario: 120 }],
  }),
]

export const orcamentoHandlers = [
  // PAG-01: sempre paginada, mais recentes primeiro, com busca pelo cliente e status.
  http.get('*/api/orcamento', ({ request }) => {
    const url = new URL(request.url)
    const pagina = Number(url.searchParams.get('pagina') ?? 1)
    const tamanho = Number(url.searchParams.get('tamanho') ?? 20)
    const termo = sem(url.searchParams.get('busca')?.trim() ?? '')
    const status = url.searchParams.get('status')
    const lista = orcamentos
      .map(comNomes)
      .filter((o) => !status || o.status === status)
      .filter((o) => !termo || sem(o.clienteNome ?? '').includes(termo))
      .sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro) || b.id - a.id)
    return HttpResponse.json(
      ok({ itens: lista.slice((pagina - 1) * tamanho, pagina * tamanho), pagina, tamanho, total: lista.length }),
    )
  }),

  http.get('*/api/orcamento/resumo', () => {
    const status: StatusOrcamento[] = ['Rascunho', 'Enviado', 'Aprovado', 'Recusado']
    return HttpResponse.json(
      ok(
        status.map((s) => {
          const l = orcamentos.filter((o) => o.status === s)
          return { status: s, quantidade: l.length, valorTotal: l.reduce((t, o) => t + o.valorTotal, 0) }
        }),
      ),
    )
  }),

  http.get('*/api/orcamento/:id', ({ params }) => {
    const o = orcamentos.find((x) => x.id === Number(params.id))
    return o ? HttpResponse.json(ok(comNomes(o))) : fail(404, 'Orçamento não encontrado.')
  }),

  // Conversão (path específico antes do :id genérico)
  http.post('*/api/orcamento/:id/converter', ({ params }) => {
    const o = orcamentos.find((x) => x.id === Number(params.id))
    if (!o) return fail(404, 'Orçamento não encontrado.')
    if (o.status !== 'Aprovado')
      return fail(422, 'Somente orçamentos aprovados podem ser convertidos.')
    if (o.atendimentoConvertidoId) return fail(422, 'Orçamento já convertido.')
    o.atendimentoConvertidoId = nextAtendId++
    o.updatedAt = new Date().toISOString()
    return HttpResponse.json(ok({ id: o.atendimentoConvertidoId }, 'Convertido em atendimento.'))
  }),

  http.post('*/api/orcamento', async ({ request }) => {
    const body = (await request.json()) as OrcamentoInput
    if (!body.itens || body.itens.length === 0)
      return fail(422, 'Informe ao menos um item.')
    const o = makeOrcamento(body)
    orcamentos = [...orcamentos, o]
    return HttpResponse.json(ok(o, 'Orçamento criado.'))
  }),

  http.put('*/api/orcamento/:id', async ({ request, params }) => {
    const body = (await request.json()) as { status: StatusOrcamento }
    const o = orcamentos.find((x) => x.id === Number(params.id))
    if (!o) return fail(404, 'Orçamento não encontrado.')
    o.status = body.status
    o.updatedAt = new Date().toISOString()
    return HttpResponse.json(ok(o, 'Status atualizado.'))
  }),

  http.delete('*/api/orcamento/:id', ({ params }) => {
    const before = orcamentos.length
    orcamentos = orcamentos.filter((x) => x.id !== Number(params.id))
    if (orcamentos.length === before) return fail(404, 'Orçamento não encontrado.')
    return HttpResponse.json(ok(null, 'Orçamento removido.'))
  }),
]
