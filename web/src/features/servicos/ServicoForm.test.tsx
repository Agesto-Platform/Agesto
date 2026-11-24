import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicoForm } from './ServicoForm'

function setup() {
  const onSubmit = vi.fn()
  render(<ServicoForm initial={null} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)
  return { onSubmit }
}

describe('ServicoForm', () => {
  it('bloqueia o envio sem descrição e sem valor', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText(/Descrição/), 'A')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Descrição deve ter no mínimo 2 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument()
  })

  it('envia o serviço por hora com o valor na hora e sem duração', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText(/Descrição/), '  Manutenção  ')
    await userEvent.type(screen.getByLabelText(/Valor por hora/), '120')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      descricao: 'Manutenção',
      tipoCobranca: 'PorHora',
      valorHora: 120,
      valorEmpreitada: null,
      duracaoMinutos: null,
    })
  })

  it('por empreitada, envia o valor da empreitada e a duração usada na margem por hora', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText(/Descrição/), 'Instalação de AC')
    await userEvent.selectOptions(screen.getByLabelText(/Cobrança/), 'Empreitada')
    await userEvent.type(screen.getByLabelText(/Valor da empreitada/), '350')
    await userEvent.type(screen.getByLabelText(/Duração estimada/), '90')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      descricao: 'Instalação de AC',
      tipoCobranca: 'Empreitada',
      valorHora: null,
      valorEmpreitada: 350,
      duracaoMinutos: 90,
    })
  })

  it('recusa duração fora de 1 a 1440 minutos', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText(/Descrição/), 'Instalação de AC')
    await userEvent.type(screen.getByLabelText(/Valor por hora/), '100')
    await userEvent.type(screen.getByLabelText(/Duração estimada/), '2000')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Informe de 1 a 1440 minutos.')).toBeInTheDocument()
  })
})
