import { http, HttpResponse } from 'msw'
import type {
  Atendimento,
  AtendimentoInput,
  AtendimentoUpdate,
  ItemProdutoResp,
  ItemProdutoInput,
  ItemServicoResp,
  ItemServicoInput,
} from '../../types/api'
import { ok, fail } from '../lib/http'
import { produtoStore } from './produtos'
import { servicoStore } from './servicos'

let nextId = 1
let nextItemProdId = 1
let nextItemServId = 1

const atendimentos: Atendimento[] = []
const itemProdutos: ItemProdutoResp[] = []
const itemServicos: ItemServicoResp[] = []

/** Recalcula valorTotal/custoTotal/margem a partir dos itens (KAN-73). */
function recalc(atId: number) {
  const at = atendimentos.find((a) => a.id === atId)
  if (!at) return
  const prods = itemProdutos.filter((i) => i.atendimentoId === atId)
  const servs = itemServicos.filter((i) => i.atendimentoId === atId)
  const valor =
    prods.reduce((s, i) => s + i.subtotal, 0) + servs.reduce((s, i) => s + i.subtotal, 0)
  const custo = prods.reduce((s, i) => s + (i.custo ?? 0), 0)
  at.valorTotal = valor
  at.custoTotal = custo
  at.margem = valor - custo
  at.updatedAt = new Date().toISOString()
}

// ---- Seeds (itens semeados não movem estoque; representam histórico) ----
function seedAtendimento(
  cliente: number,
  status: Atendimento['status'],
  dataAgendada: string | null,
  usuarioId = 1,
): Atendimento {
  const now = new Date().toISOString()
  const at: Atendimento = {
    id: nextId++,
    uuid: crypto.randomUUID(),
    dataRegistro: now,
    dataAgendada,
    status,
    valorTotal: 0,
    custoTotal: 0,
    margem: 0,
    clienteId: cliente,
    usuarioId,
    createdAt: now,
    updatedAt: now,
  }
  atendimentos.push(at)
  return at
}
function seedItemProd(atId: number, produtoId: number | null, descricao: string | null, qtd: number, preco: number, custo: number | null) {
  const now = new Date().toISOString()
  itemProdutos.push({ id: nextItemProdId++, uuid: crypto.randomUUID(), quantidade: qtd, precoUnitario: preco, subtotal: qtd * preco, custo, descricao, atendimentoId: atId, produtoId, createdAt: now, updatedAt: now })
}
function seedItemServ(atId: number, servicoId: number, qtd: number, preco: number) {
  const now = new Date().toISOString()
  itemServicos.push({ id: nextItemServId++, uuid: crypto.randomUUID(), quantidade: qtd, precoUnitario: preco, subtotal: qtd * preco, atendimentoId: atId, servicoId, createdAt: now, updatedAt: now })
}

function d(offsetDays: number, hour = 10): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays, hour).toISOString()
}

const a1 = seedAtendimento(1, 'Concluido', d(-3, 9))
seedItemServ(a1.id, 1, 1, 350)
seedItemProd(a1.id, 1, null, 2, 70, 90)
const a2 = seedAtendimento(2, 'Pendente', d(2, 14), 2)
seedItemServ(a2.id, 2, 1, 140)
const a3 = seedAtendimento(3, 'Concluido', d(-1, 11))
seedItemProd(a3.id, null, 'Cabo especial', 1, 30, 12)
;[a1, a2, a3].forEach((a) => recalc(a.id))

export const atendimentoHandlers = [
  http.get('*/api/atendimento', () => HttpResponse.json(ok(atendimentos))),

  http.post('*/api/atendimento', async ({ request }) => {
    const b = (await request.json()) as AtendimentoInput
    const now = new Date().toISOString()
    const at: Atendimento = {
      id: nextId++,
      uuid: crypto.randomUUID(),
      dataRegistro: b.dataAgendada ? now : now,
      dataAgendada: b.dataAgendada ?? null,
      status: b.status,
      valorTotal: 0,
      custoTotal: 0,
      margem: 0,
      clienteId: b.clienteId,
      usuarioId: b.responsavelId ?? 1,
      createdAt: now,
      updatedAt: now,
    }
    atendimentos.push(at)
    return HttpResponse.json(ok(at, 'Atendimento criado.'))
  }),

  http.put('*/api/atendimento/:id', async ({ request, params }) => {
    const b = (await request.json()) as AtendimentoUpdate
    const at = atendimentos.find((a) => a.id === Number(params.id))
    if (!at) return fail(404, 'Atendimento não encontrado.')
    at.status = b.status
    at.dataAgendada = b.dataAgendada ?? null
    if (b.responsavelId != null) at.usuarioId = b.responsavelId
    at.updatedAt = new Date().toISOString()
    return HttpResponse.json(ok(at, 'Atendimento atualizado.'))
  }),

  http.delete('*/api/atendimento/:id', ({ params }) => {
    const id = Number(params.id)
    const at = atendimentos.find((a) => a.id === id)
    if (!at) return fail(404, 'Atendimento não encontrado.')
    // devolve estoque dos itens de produto de catálogo
    itemProdutos
      .filter((i) => i.atendimentoId === id && i.produtoId != null)
      .forEach((i) => {
        const p = produtoStore.get(i.produtoId!)
        if (p) produtoStore.update(i.produtoId!, { quantidadeEstoque: p.quantidadeEstoque + i.quantidade })
      })
    for (let k = itemProdutos.length - 1; k >= 0; k--) if (itemProdutos[k].atendimentoId === id) itemProdutos.splice(k, 1)
    for (let k = itemServicos.length - 1; k >= 0; k--) if (itemServicos[k].atendimentoId === id) itemServicos.splice(k, 1)
    atendimentos.splice(atendimentos.indexOf(at), 1)
    return HttpResponse.json(ok(null, 'Atendimento removido.'))
  }),

  // ---- Itens de produto ----
  http.get('*/api/itemproduto', ({ request }) => {
    const atId = Number(new URL(request.url).searchParams.get('atendimentoId'))
    return HttpResponse.json(ok(itemProdutos.filter((i) => i.atendimentoId === atId)))
  }),
  http.post('*/api/itemproduto', async ({ request }) => {
    const b = (await request.json()) as ItemProdutoInput
    const at = atendimentos.find((a) => a.id === b.atendimentoId)
    if (!at) return fail(404, 'Atendimento não encontrado.')
    let preco = b.precoUnitario ?? undefined
    const produtoId = b.produtoId ?? null
    const descricao = b.descricao ?? null
    if (produtoId != null) {
      const p = produtoStore.get(produtoId)
      if (!p) return fail(404, 'Produto não encontrado.')
      if (preco == null) preco = p.preco
      if (p.quantidadeEstoque < b.quantidade)
        return fail(400, `Estoque insuficiente de ${p.nome} (disponível: ${p.quantidadeEstoque}).`)
      produtoStore.update(produtoId, { quantidadeEstoque: p.quantidadeEstoque - b.quantidade })
    } else {
      if (!descricao) return fail(400, 'Item avulso exige descrição.')
      if (preco == null) preco = 0
    }
    const now = new Date().toISOString()
    const item: ItemProdutoResp = {
      id: nextItemProdId++, uuid: crypto.randomUUID(), quantidade: b.quantidade,
      precoUnitario: preco, subtotal: b.quantidade * preco, custo: b.custo ?? null,
      descricao, atendimentoId: b.atendimentoId, produtoId, createdAt: now, updatedAt: now,
    }
    itemProdutos.push(item)
    recalc(b.atendimentoId)
    return HttpResponse.json(ok(item, 'Item de produto criado.'))
  }),
  http.delete('*/api/itemproduto/:id', ({ params }) => {
    const idx = itemProdutos.findIndex((i) => i.id === Number(params.id))
    if (idx < 0) return fail(404, 'Item não encontrado.')
    const item = itemProdutos[idx]
    if (item.produtoId != null) {
      const p = produtoStore.get(item.produtoId)
      if (p) produtoStore.update(item.produtoId, { quantidadeEstoque: p.quantidadeEstoque + item.quantidade })
    }
    itemProdutos.splice(idx, 1)
    recalc(item.atendimentoId)
    return HttpResponse.json(ok(null, 'Item removido.'))
  }),

  // ---- Itens de serviço ----
  http.get('*/api/itemservico', ({ request }) => {
    const atId = Number(new URL(request.url).searchParams.get('atendimentoId'))
    return HttpResponse.json(ok(itemServicos.filter((i) => i.atendimentoId === atId)))
  }),
  http.post('*/api/itemservico', async ({ request }) => {
    const b = (await request.json()) as ItemServicoInput
    const at = atendimentos.find((a) => a.id === b.atendimentoId)
    if (!at) return fail(404, 'Atendimento não encontrado.')
    const s = servicoStore.get(b.servicoId)
    if (!s) return fail(404, 'Serviço não encontrado.')
    const preco = b.precoUnitario ?? s.valorHora ?? s.valorEmpreitada ?? 0
    const now = new Date().toISOString()
    const item: ItemServicoResp = {
      id: nextItemServId++, uuid: crypto.randomUUID(), quantidade: b.quantidade,
      precoUnitario: preco, subtotal: b.quantidade * preco, atendimentoId: b.atendimentoId,
      servicoId: b.servicoId, createdAt: now, updatedAt: now,
    }
    itemServicos.push(item)
    recalc(b.atendimentoId)
    return HttpResponse.json(ok(item, 'Item de serviço criado.'))
  }),
  http.delete('*/api/itemservico/:id', ({ params }) => {
    const idx = itemServicos.findIndex((i) => i.id === Number(params.id))
    if (idx < 0) return fail(404, 'Item não encontrado.')
    const item = itemServicos[idx]
    itemServicos.splice(idx, 1)
    recalc(item.atendimentoId)
    return HttpResponse.json(ok(null, 'Item removido.'))
  }),
]
