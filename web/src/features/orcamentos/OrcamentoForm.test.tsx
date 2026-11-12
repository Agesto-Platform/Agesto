import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrcamentoForm } from './OrcamentoForm'
import type { Servico } from '../../types/api'

vi.mock('../parametrizacao/queries', () => ({ useConfiguracao: () => ({ data: { tipoOperacao: 'Hibrido' } }) }))
vi.mock('../servicos/sugeridosQueries', () => ({ useServicoSugeridos: () => ({ data: [] }) }))

function servico(id: number, tipoCobranca: Servico['tipoCobranca'], descricao: string): Servico {
  return {
    id,
    uuid: `s${id}`,
    descricao,
    tipoCobranca,
    valorHora: tipoCobranca === 'PorHora' ? 100 : null,
    valorEmpreitada: tipoCobranca === 'Empreitada' ? 350 : null,
    duracaoMinutos: null,
    revisado: true,
    criadoPorUsuarioId: null,
    criadoPorNome: null,
    createdAt: '',
    updatedAt: '',
  }
}

const servicos = [servico(1, 'Empreitada', 'Instalação'), servico(2, 'PorHora', 'Manutenção')]

function setup() {
  render(
    <OrcamentoForm clientes={[]} produtos={[]} servicos={servicos} onSubmit={vi.fn()} submitting={false} onCancel={vi.fn()} />,
  )
}

// E2E-02: no atendimento a empreitada cobra 1 × valor; o orçamento trava em 1.
describe('OrcamentoForm — quantidade da empreitada', () => {
  it('trava a quantidade em 1 e adiciona a linha com 1', async () => {
    setup()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Tipo'), 'servico')
    await user.selectOptions(screen.getByLabelText('Serviço'), '1')

    const qtd = screen.getByLabelText('Qtd.')
    expect(qtd).toBeDisabled()
    expect(qtd).toHaveValue(1)
    expect(screen.getByText(/Empreitada: 1 por linha/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    expect(screen.getAllByText('R$ 350,00').length).toBeGreaterThan(0)
  })

  it('serviço por hora continua aceitando outra quantidade', async () => {
    setup()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Tipo'), 'servico')
    await user.selectOptions(screen.getByLabelText('Serviço'), '2')

    const qtd = screen.getByLabelText('Qtd.')
    expect(qtd).toBeEnabled()
    await user.clear(qtd)
    await user.type(qtd, '3')
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    expect(screen.getAllByText('R$ 300,00').length).toBeGreaterThan(0)
  })
})
