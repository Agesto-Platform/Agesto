import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BaixarApp } from './BaixarApp'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

describe('BaixarApp', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('mostra o botão com o link do APK que a API devolve', async () => {
    get.mockResolvedValue({ versaoMinimaAndroid: '1.0.0', urlDownload: 'https://exemplo.com/agesto.apk' })
    render(<BaixarApp />)

    const link = await screen.findByRole('link', { name: /Baixar o app/i })
    expect(link).toHaveAttribute('href', 'https://exemplo.com/agesto.apk')
    expect(get).toHaveBeenCalledWith('/api/app/versao')
  })

  it('sem link configurado, orienta a falar com o responsável', async () => {
    get.mockResolvedValue({ versaoMinimaAndroid: null, urlDownload: null })
    render(<BaixarApp />)

    expect(await screen.findByText(/ainda não está disponível/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Baixar o app/i })).not.toBeInTheDocument()
  })

  it('se a API falhar, pede para tentar de novo', async () => {
    get.mockImplementation(() => Promise.reject(new Error('offline')))
    render(<BaixarApp />)

    expect(await screen.findByText(/Tente de novo/i)).toBeInTheDocument()
  })
})
