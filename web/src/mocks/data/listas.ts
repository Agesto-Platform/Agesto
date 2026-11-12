import { http, HttpResponse } from 'msw'
import type { Atendimento, AtendimentoContagem, Cliente, Pagina } from '../../types/api'
import { onlyDigits } from '../../lib/masks'
import { ok, fail } from '../lib/http'
import { clienteStore } from './clientes'
import { atendimentos, resumo } from './atendimentos'

/**
 * PAG-01: as listas paginadas como a API faz (`?pagina=&tamanho=&busca=&status=&clienteId=`),
 * a contagem das abas e o detalhe por id. Sem nenhum desses parâmetros, cai no handler
 * seguinte (a lista inteira), que outras telas ainda usam.
 */
const sem = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function paginar<T>(itens: T[], url: URL): Pagina<T> {
  const pagina = Number(url.searchParams.get('pagina') ?? 1)
  const tamanho = Number(url.searchParams.get('tamanho') ?? 20)
  return { itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho), pagina, tamanho, total: itens.length }
}

const paginada = (url: URL, filtros: string[]) =>
  ['pagina', 'tamanho', ...filtros].some((k) => url.searchParams.has(k))

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
    if (!paginada(url, ['busca', 'status', 'clienteId'])) return undefined
    const termo = sem(url.searchParams.get('busca') ?? '')
    const status = url.searchParams.get('status')
    const clienteId = url.searchParams.get('clienteId')
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
      .sort((a, b) => dataRef(b).localeCompare(dataRef(a)) || b.id - a.id)
    return HttpResponse.json(ok(paginar(lista, url)))
  }),

  http.get('*/api/cliente', ({ request }) => {
    const url = new URL(request.url)
    if (!paginada(url, ['busca'])) return undefined
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
