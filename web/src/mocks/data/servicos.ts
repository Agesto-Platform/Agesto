import { http, HttpResponse } from 'msw'
import type { Servico, ServicoSugerido, ServicoSugeridoInput } from '../../types/api'
import { makeStore, crudHandlers, fail, ok, type Store } from '../lib/http'
import { produtoStore } from './produtos'

const now = new Date().toISOString()

const doDono = { revisado: true, criadoPorUsuarioId: null, criadoPorNome: null }

const seed: Servico[] = [
  { id: 1, uuid: crypto.randomUUID(), descricao: 'Instalação de AC', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 350, duracaoMinutos: 120, ...doDono, createdAt: now, updatedAt: now },
  { id: 2, uuid: crypto.randomUUID(), descricao: 'Manutenção preventiva', tipoCobranca: 'PorHora', valorHora: 140, valorEmpreitada: null, duracaoMinutos: null, ...doDono, createdAt: now, updatedAt: now },
  { id: 3, uuid: crypto.randomUUID(), descricao: 'Limpeza / higienização', tipoCobranca: 'PorHora', valorHora: 90, valorEmpreitada: null, duracaoMinutos: null, ...doDono, createdAt: now, updatedAt: now },
  // Criado pelo agente no app, aguardando revisão (DEC-36).
  { id: 4, uuid: crypto.randomUUID(), descricao: 'Limpeza de dreno', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 120, duracaoMinutos: null, revisado: false, criadoPorUsuarioId: 2, criadoPorNome: 'Carlos', createdAt: now, updatedAt: now },
]

export const servicoStore: Store<Servico> = makeStore(seed)

export const servicoHandlers = [
  http.post('*/api/servico/:id/revisar', ({ params }) => {
    const s = servicoStore.update(Number(params.id), { revisado: true })
    if (!s) return fail(404, 'Servico nao encontrado.')
    return HttpResponse.json(ok(s, 'Servico revisado.'))
  }),
  // Criar ou editar pelo web é o Dono: já fica revisado, como no backend.
  http.post('*/api/servico', async ({ request }) => {
    const body = (await request.json()) as Omit<Servico, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>
    return HttpResponse.json(ok(servicoStore.create({ ...body, ...doDono }), 'Criado com sucesso.'))
  }),
  http.put('*/api/servico/:id', async ({ request, params }) => {
    const body = (await request.json()) as Partial<Servico>
    const s = servicoStore.update(Number(params.id), { ...body, revisado: true })
    if (!s) return fail(404, 'Registro não encontrado.')
    return HttpResponse.json(ok(s, 'Atualizado com sucesso.'))
  }),
  ...crudHandlers('/api/servico', servicoStore),
]

// Kit de materiais sugeridos por serviço (stateful em memória).
const sugeridosPorServico = new Map<number, ServicoSugeridoInput[]>()

function resolveSugeridos(servicoId: number): ServicoSugerido[] {
  return (sugeridosPorServico.get(servicoId) ?? []).map((i) => ({
    produtoId: i.produtoId,
    produtoNome: produtoStore.get(i.produtoId)?.nome ?? '',
    quantidadePadrao: i.quantidadePadrao,
  }))
}

export const servicoSugeridoHandlers = [
  http.get('*/api/servico/:id/sugeridos', ({ params }) =>
    HttpResponse.json(ok(resolveSugeridos(Number(params.id)), 'Materiais sugeridos.')),
  ),
  http.put('*/api/servico/:id/sugeridos', async ({ params, request }) => {
    const body = (await request.json()) as ServicoSugeridoInput[]
    // Dedupe por produtoId (última quantidade vence), como o backend.
    const map = new Map<number, number>()
    for (const it of body) map.set(it.produtoId, it.quantidadePadrao)
    const dedup = [...map].map(([produtoId, quantidadePadrao]) => ({ produtoId, quantidadePadrao }))
    sugeridosPorServico.set(Number(params.id), dedup)
    return HttpResponse.json(ok(resolveSugeridos(Number(params.id)), 'Materiais sugeridos atualizados.'))
  }),
]
