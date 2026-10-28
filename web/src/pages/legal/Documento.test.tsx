import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Documento } from './Documento'
import type { DocumentoLegal } from './textos'

const outro = { to: '/privacidade', label: 'Política de privacidade' }
const renderDoc = (doc: DocumentoLegal) =>
  render(
    <MemoryRouter>
      <Documento doc={doc} outro={outro} />
    </MemoryRouter>,
  )

describe('Documento', () => {
  it('sem texto publicado, avisa que está em revisão', () => {
    renderDoc({ titulo: 'Termos de uso', atualizadoEm: null, secoes: [] })

    expect(screen.getByRole('heading', { level: 1, name: /Termos de uso/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/em revisão/i)
  })

  it('com texto, mostra a data e as seções', () => {
    renderDoc({
      titulo: 'Termos de uso',
      atualizadoEm: '1º de novembro de 2026',
      secoes: [{ titulo: '1. Uso do serviço', paragrafos: ['Primeiro parágrafo.', 'Segundo parágrafo.'] }],
    })

    expect(screen.getByText(/Atualizado em 1º de novembro de 2026/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '1. Uso do serviço' })).toBeInTheDocument()
    expect(screen.getByText('Segundo parágrafo.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('aponta para o outro documento', () => {
    renderDoc({ titulo: 'Termos de uso', atualizadoEm: null, secoes: [] })

    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade')
  })
})
