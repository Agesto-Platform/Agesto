import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrcamentoDetail } from './OrcamentoDetail'
import type { Orcamento, StatusOrcamento } from '../../types/api'

function orcamento(status: StatusOrcamento, extra: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 1,
    uuid: 'u',
    clienteId: 1,
    status,
    valorTotal: 490,
    dataRegistro: '2026-10-20T12:00:00.000Z',
    atendimentoConvertidoId: null,
    createdAt: '',
    updatedAt: '',
    itens: [
      { id: 1, produtoId: null, servicoId: null, descricao: 'Visita técnica', quantidade: 1, precoUnitario: 490, subtotal: 490, custo: null },
    ],
    ...extra,
  }
}

function setup(o: Orcamento) {
  const props = { onChangeStatus: vi.fn(), onConvert: vi.fn(), onEdit: vi.fn() }
  render(
    <OrcamentoDetail orcamento={o} clienteNome="Vó Joana" busy={{ status: false, convert: false }} {...props} />,
  )
  return props
}

describe('OrcamentoDetail', () => {
  it('rascunho: marca como enviado', async () => {
    const p = setup(orcamento('Rascunho'))
    await userEvent.click(screen.getByRole('button', { name: /Marcar como enviado/i }))
    expect(p.onChangeStatus).toHaveBeenCalledWith('Enviado')
  })

  it('enviado: aprova ou recusa', async () => {
    const p = setup(orcamento('Enviado'))
    await userEvent.click(screen.getByRole('button', { name: /Marcar como aprovado/i }))
    await userEvent.click(screen.getByRole('button', { name: /Recusado/i }))
    expect(p.onChangeStatus.mock.calls).toEqual([['Aprovado'], ['Recusado']])
  })

  it('aprovado: converte em atendimento; sem custo, a margem pede o custo', async () => {
    const p = setup(orcamento('Aprovado'))
    await userEvent.click(screen.getByRole('button', { name: /Converter em atendimento/i }))
    expect(p.onConvert).toHaveBeenCalled()
    expect(screen.getByText('preencha o custo')).toBeInTheDocument()
  })

  it('nomeia os itens de catálogo pelo que vem no item, sem baixar o catálogo (PAG-01)', () => {
    setup(
      orcamento('Rascunho', {
        itens: [
          { id: 2, produtoId: 5, servicoId: null, descricao: null, produtoNome: 'Cano de cobre', quantidade: 2, precoUnitario: 40, subtotal: 80, custo: null },
          { id: 3, produtoId: null, servicoId: 8, descricao: null, servicoDescricao: 'Instalação split', tipoCobranca: 'Empreitada', quantidade: 1, precoUnitario: 350, subtotal: 350, custo: null },
        ],
      }),
    )
    expect(screen.getByText('Cano de cobre')).toBeInTheDocument()
    expect(screen.getByText('Instalação split')).toBeInTheDocument()
    expect(screen.getByText(/Serviço · Empreitada/)).toBeInTheDocument()
  })

  it('convertido: não oferece converter de novo', () => {
    setup(orcamento('Aprovado', { atendimentoConvertidoId: 9 }))
    expect(screen.queryByRole('button', { name: /Converter em atendimento/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Convertido no atendimento #9/i)).toBeInTheDocument()
  })
})
