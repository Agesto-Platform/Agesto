import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PaginaDeVenda } from './PaginaDeVenda'
import { totalMensal } from './oferta'

function renderizar() {
  render(
    <MemoryRouter>
      <PaginaDeVenda />
    </MemoryRouter>,
  )
}

describe('totalMensal', () => {
  it('a assinatura já inclui 1 funcionário; os demais pagam licença', () => {
    expect(totalMensal(0)).toBe(49.9)
    expect(totalMensal(1)).toBe(49.9)
    expect(totalMensal(2)).toBe(69.8)
    expect(totalMensal(4)).toBe(109.6)
  })
})

describe('PaginaDeVenda', () => {
  it('mostra a promessa, os preços e o caminho para entrar', () => {
    renderizar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sua empresa inteira em um lugar só.')
    expect(screen.getAllByText('R$ 49,90').length).toBeGreaterThan(0)
    expect(screen.getAllByText('R$ 19,90').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login')
  })

  it('o contato abre o WhatsApp comercial com a mensagem pronta', () => {
    renderizar()
    const link = screen.getByRole('link', { name: /Quero o Agesto/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/5534996326130?text='))
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('Quero conhecer o Agesto')
  })

  it('a calculadora soma as licenças e leva a quantidade para a mensagem', async () => {
    renderizar()
    // Começa com 2 funcionários: a assinatura (com 1 incluso) + 1 licença extra.
    expect(screen.getByText('R$ 69,80')).toBeInTheDocument()
    expect(screen.getByText('Assinatura + 1 licença extra.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mais um funcionário' }))
    expect(screen.getByText('R$ 89,70')).toBeInTheDocument()
    const assinar = screen.getByRole('link', { name: /Quero assinar/ })
    expect(decodeURIComponent(assinar.getAttribute('href')!)).toContain('com 3 funcionários')
  })
})
