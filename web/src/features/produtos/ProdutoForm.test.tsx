import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProdutoForm } from './ProdutoForm'
import type { Produto } from '../../types/api'

function setup(props: { initial?: Produto | null; controlaEstoque?: boolean } = {}) {
  const onSubmit = vi.fn()
  render(
    <ProdutoForm
      initial={props.initial ?? null}
      controlaEstoque={props.controlaEstoque}
      onSubmit={onSubmit}
      submitting={false}
      onCancel={vi.fn()}
    />,
  )
  return { onSubmit }
}

describe('ProdutoForm', () => {
  it('bloqueia o envio sem nome, preço e estoque', async () => {
    const { onSubmit } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Nome deve ter no mínimo 2 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Preço deve ser maior que zero.')).toBeInTheDocument()
    expect(screen.getByText('Quantidade inválida.')).toBeInTheDocument()
  })

  it('envia o produto com o nome sem espaços nas pontas', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText(/Nome/), '  Fita PVC ')
    await userEvent.type(screen.getByLabelText(/Preço/), '12.5')
    await userEvent.type(screen.getByLabelText(/Estoque/), '30')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Fita PVC', preco: 12.5, quantidadeEstoque: 30 })
  })

  it('na edição, mostra o Excluir e envia o que mudou', async () => {
    const onDelete = vi.fn()
    const onSubmit = vi.fn()
    const produto = { id: 7, nome: 'Fita PVC', preco: 12.5, quantidadeEstoque: 30 } as Produto
    render(<ProdutoForm initial={produto} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /Excluir/ }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    await userEvent.clear(screen.getByLabelText(/Estoque/))
    await userEvent.type(screen.getByLabelText(/Estoque/), '28')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Fita PVC', preco: 12.5, quantidadeEstoque: 28 })
  })

  it('sem controle de estoque, esconde o campo e preserva a quantidade na edição', async () => {
    const produto: Produto = {
      id: 7,
      nome: 'Gás R-410a (kg)',
      preco: 90,
      quantidadeEstoque: 3,
    } as Produto
    const { onSubmit } = setup({ initial: produto, controlaEstoque: false })
    expect(screen.queryByLabelText(/Estoque/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Gás R-410a (kg)', preco: 90, quantidadeEstoque: 3 })
  })
})
