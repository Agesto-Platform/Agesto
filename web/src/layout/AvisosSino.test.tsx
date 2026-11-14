import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AvisosSino } from './AvisosSino'
import type { AgendaItem, AvisosAgenda } from '../types/api'

let avisos: AvisosAgenda = { hoje: [], atrasados: [], totalAtrasados: 0 }
vi.mock('../lib/queries', () => ({
  useAvisos: () => ({ data: avisos, isLoading: false, isError: false }),
}))

function item(id: number, dataAgendada: string, clienteNome: string): AgendaItem {
  return {
    id,
    uuid: `u${id}`,
    dataAgendada,
    status: 'Pendente',
    valorTotal: 100,
    usuarioId: 1,
    clienteId: id,
    clienteNome,
    clienteTelefone: null,
    enderecoResumo: null,
    resumo: 'Instalação de AC',
  }
}

function Onde() {
  return <p data-testid="onde">{useLocation().pathname + useLocation().search}</p>
}

function setup() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AvisosSino />
      <Routes>
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AvisosSino', () => {
  it('sem pendentes: sem contador e com a mensagem de vazio', async () => {
    avisos = { hoje: [], atrasados: [], totalAtrasados: 0 }
    setup()
    const sino = screen.getByRole('button', { name: /nenhum atendimento pendente/i })
    expect(sino.querySelector('.badge')).toBeNull()
    await userEvent.setup().click(sino)
    expect(screen.getByText('Nenhum atendimento pendente hoje.')).toBeInTheDocument()
  })

  it('conta hoje + atrasados e leva para a Agenda no dia do atendimento', async () => {
    const hoje = new Date()
    hoje.setHours(14, 30, 0, 0)
    const atrasado = new Date(2026, 9, 20, 9, 0, 0)
    avisos = {
      hoje: [item(1, hoje.toISOString(), 'Vó Joana')],
      atrasados: [item(2, atrasado.toISOString(), 'Marina Alves')],
      totalAtrasados: 3,
    }
    setup()
    const user = userEvent.setup()
    const sino = screen.getByRole('button', { name: /1 pendente hoje, 3 atrasados/i })
    expect(sino).toHaveTextContent('4')

    await user.click(sino)
    expect(screen.getByText('Atrasados (1 de 3)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Marina Alves/ }))
    expect(screen.getByTestId('onde')).toHaveTextContent('/agenda?dia=2026-10-20')
  })
})
