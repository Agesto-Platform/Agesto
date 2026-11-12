import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, userEvent } from '@testing-library/react-native'
import Atendimentos from '@/app/(tabs)/atendimentos'
import { api } from '@/lib/api'
import { db } from '@/db/instance'
import type { AgendaItem, PaginaResponse } from '@/types/api'

// No jest o preset resolve os adapters .native (SQLite): troca por memória.
jest.mock('@/db/instance', () => ({
  db: (jest.requireActual('@/db/memoryDb') as typeof import('@/db/memoryDb')).createMemoryDb(),
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react')
  return {
    useRouter: () => ({ push: jest.fn() }),
    // Na tela real roda ao ganhar foco; aqui, ao montar.
    useFocusEffect: (efeito: () => void | (() => void)) => useEffect(efeito, [efeito]),
  }
})

const item = (uuid: string, clienteNome: string, data: string, valorTotal: number): AgendaItem => ({
  id: 1, uuid, dataAgendada: null, dataRegistro: data, status: 'Concluido', valorTotal, clienteId: 1, clienteNome,
  clienteTelefone: null, enderecoResumo: null, resumo: 'Manutenção preventiva',
  itens: [{ descricao: 'Manutenção preventiva', quantidade: 1, precoUnitario: valorTotal, subtotal: valorTotal }],
})
const pagina = (itens: AgendaItem[], numero: number, total: number): PaginaResponse<AgendaItem> => ({
  itens, pagina: numero, tamanho: 20, total,
})

beforeEach(async () => {
  await db.reset()
  // Registrado neste aparelho e ainda não enviado.
  await db.addAtendimento({
    uuid: 'local-1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-11-12T10:00:00Z', dataAgendada: null,
    itensProduto: [], itensServico: [], syncedAt: null,
  })
})
afterEach(() => {
  jest.restoreAllMocks()
})

describe('aba Atendimentos', () => {
  it('mostra o não enviado no topo e o histórico do servidor, com "Carregar mais"', async () => {
    const user = userEvent.setup()
    const get = jest
      .spyOn(api, 'get')
      .mockResolvedValueOnce(pagina([item('srv-1', 'Marina Alves', '2026-11-10T10:00:00Z', 380)], 1, 2))
      .mockResolvedValueOnce(pagina([item('srv-2', 'Renata Vieira', '2026-11-01T10:00:00Z', 90)], 2, 2))
    await render(<Atendimentos />)

    expect(await screen.findByText('Marina Alves')).toBeOnTheScreen()
    expect(screen.getByText('R$ 380')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Corrigir atendimento de Cliente #1' })).toBeOnTheScreen()
    expect(screen.queryByText(/Não deu para buscar o histórico/)).not.toBeOnTheScreen()

    await user.press(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByText('Renata Vieira')).toBeOnTheScreen()
    expect(get).toHaveBeenLastCalledWith('/api/atendimento/historico?pagina=2&tamanho=20')
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeOnTheScreen()
  })

  it('sem internet mostra só o que está no aparelho e avisa', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(new TypeError('Network request failed'))
    await render(<Atendimentos />)

    expect(await screen.findByText(/Não deu para buscar o histórico agora/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Corrigir atendimento de Cliente #1' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeOnTheScreen()
  })
})
