import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Manual } from './Manual'
import { AGENTE, DONO } from './conteudo'

const renderManual = () =>
  render(
    <MemoryRouter>
      <Manual />
    </MemoryRouter>,
  )

describe('Manual', () => {
  it('tem as partes do dono e do agente', () => {
    renderManual()

    expect(screen.getByRole('heading', { level: 1, name: /Manual de uso/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Para o dono/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Para o agente/ })).toBeInTheDocument()
  })

  it('o índice leva a cada seção', () => {
    renderManual()
    const indice = screen.getByRole('navigation', { name: 'Índice' })

    for (const [parte, secoes] of [
      ['dono', DONO],
      ['agente', AGENTE],
    ] as const) {
      for (const s of secoes) {
        const link = within(indice).getByRole('link', { name: s.titulo })
        expect(link).toHaveAttribute('href', `#${parte}-${s.id}`)
        expect(document.getElementById(`${parte}-${s.id}`)).toHaveTextContent(s.titulo)
      }
    }
  })

  it('manda o agente instalar pela página de download', () => {
    renderManual()

    expect(screen.getByRole('link', { name: 'Baixar o app' })).toHaveAttribute('href', '/baixar')
  })
})
