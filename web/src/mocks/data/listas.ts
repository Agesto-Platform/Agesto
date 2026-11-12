import { http, HttpResponse } from 'msw'
import type { Atendimento, AtendimentoContagem, Cliente, Pagina } from '../../types/api'
import { onlyDigits } from '../../lib/masks'
import { ok, fail } from '../lib/http'
import { clienteStore } from './clientes'
import { produtoStore } from './produtos'
import { servicoStore } from './servicos'
import { atendimentos, resumo } from './atendimentos'

/**
 * PAG-01: as listas como a API faz, sempre paginadas (fase 3, sem parâmetros vem a
 * página 1 com 20): clientes, atendimentos, produtos e serviços, com busca e filtros,
 * a contagem das abas e o detalhe do atendimento por id.
 */
const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function paginar<T>(itens: T[], url: URL): Pagina<T> {
  const pagina = Number(url.searchParams.get('pagina') ?? 1)
  const tamanho = Number(url.searchParams.get('tamanho') ?? 20)
  return { itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho), pagina, tamanho, total: itens.length }
}

const dataRef = (a: Atendimento) => a.dataAgendada ?? a.dataRegistro

function enderecoResumo(c: Cliente | undefined): string | null {
  if (!c) return null
  const rua = [c.logradouro, c.numero].filter(Boolean).join(', ')
  return [rua, c.bairro].filter(Boolean).join(' — ') || null
}

export const listasHandlers = [
  http.get('*/api/atendimento/contagem', () => {
    const conta = (s?: string) => atendimentos.filter((a) => !s || a.status === s).length
    const data: AtendimentoContagem = {
      todos: conta(),
      pendente: conta('Pendente'),
      concluido: conta('Concluido'),
      cancelado: conta('Cancelado'),
    }
    return HttpResponse.json(ok(data))
  }),

  http.get('*/api/atendimento/:id', ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id)) return undefined
    const a = atendimentos.find((x) => x.id === id)
    return a ? HttpResponse.json(ok({ ...a, resumo: resumo(a.id) })) : fail(404, 'Atendimento não encontrado.')
  }),

  http.get('*/api/atendimento', ({ request }) => {
    const url = new URL(request.url)
    const termo = sem(url.searchParams.get('busca') ?? '')
    const status = url.searchParams.get('status')
    const clienteId = url.searchParams.get('clienteId')
    // ordem=registro: os últimos registrados primeiro (Dashboard).
    const porRegistro = url.searchParams.get('ordem') === 'registro'
    const lista = atendimentos
      .map((a) => {
        const c = clienteStore.get(a.clienteId)
        return {
          ...a,
          resumo: resumo(a.id),
          clienteNome: c?.nome ?? null,
          clienteTelefone: c?.telefone ?? null,
          enderecoResumo: enderecoResumo(c),
        }
      })
      .filter((a) => !status || a.status === status)
      .filter((a) => !clienteId || a.clienteId === Number(clienteId))
      .filter((a) => !termo || sem(`${a.clienteNome ?? ''} ${a.resumo ?? ''}`).includes(termo))
      .sort((a, b) =>
        porRegistro
          ? b.dataRegistro.localeCompare(a.dataRegistro) || b.id - a.id
          : dataRef(b).localeCompare(dataRef(a)) || b.id - a.id,
      )
    return HttpResponse.json(ok(paginar(lista, url)))
  }),

  http.get('*/api/produto', ({ request }) => {
    const url = new URL(request.url)
    const termo = sem(url.searchParams.get('busca')?.trim() ?? '')
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).map(Number)
    const lista = produtoStore
      .list()
      .filter((p) => !termo || sem(p.nome).includes(termo))
      .filter((p) => ids.length === 0 || ids.includes(p.id))
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id)
    return HttpResponse.json(ok(paginar(lista, url)))
  }),

  http.get('*/api/servico', ({ request }) => {
    const url = new URL(request.url)
    const termo = sem(url.searchParams.get('busca')?.trim() ?? '')
    const revisado = url.searchParams.get('revisado')
    const lista = servicoStore
      .list()
      .filter((s) => !termo || sem(s.descricao).includes(termo))
      .filter((s) => revisado === null || String(s.revisado) === revisado)
    return HttpResponse.json(ok(paginar(lista, url)))
  }),

  http.get('*/api/cliente', ({ request }) => {
    const url = new URL(request.url)
    const busca = url.searchParams.get('busca') ?? ''
    const termo = sem(busca.trim())
    const digitos = onlyDigits(busca)
    const lista = clienteStore
      .list()
      .filter((c) => {
        if (!termo) return true
        const texto = sem([c.nome, c.logradouro, c.bairro, c.cidade].filter(Boolean).join(' '))
        return texto.includes(termo) || (digitos.length >= 3 && onlyDigits(c.telefone ?? '').includes(digitos))
      })
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id)
      .map((c) => {
        const doCliente = atendimentos.filter((a) => a.clienteId === c.id)
        const ultimo = doCliente.map(dataRef).sort().at(-1) ?? null
        return { ...c, totalAtendimentos: doCliente.length, ultimoAtendimento: ultimo }
      })
    return HttpResponse.json(ok(paginar(lista, url)))
  }),
]
