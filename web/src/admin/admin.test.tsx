import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminLayout } from './AdminLayout'
import { AdminEmpresasPage } from './AdminEmpresasPage'
import { ToastProvider } from '../components/ui'
import { adminApi, adminLogado, setAdminToken } from './sessao'

vi.mock('./sessao', async (importOriginal) => {
  const real = await importOriginal<typeof import('./sessao')>()
  return { ...real, adminApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }
})

const get = vi.mocked(adminApi.get)

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.x`
}

const exp = () => Math.floor(Date.now() / 1000) + 3600

function emRotas(inicial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[inicial]}>
          <Routes>
            <Route path="/admin/login" element={<p>tela de login do admin</p>} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminEmpresasPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('área de superadmin', () => {
  beforeEach(() => {
    localStorage.clear()
    get.mockReset()
  })

  it('sem token de admin, manda para o login do admin', () => {
    emRotas('/admin')
    expect(screen.getByText('tela de login do admin')).toBeInTheDocument()
  })

  it('o token do painel do cliente não abre a área de admin', () => {
    localStorage.setItem('agesto_token', jwt({ sub: '1', empresaId: '1', perfil: 'Dono', exp: exp() }))
    emRotas('/admin')
    expect(screen.getByText('tela de login do admin')).toBeInTheDocument()
  })

  it('só aceita token de admin com escopo de plataforma e dentro da validade', () => {
    setAdminToken(jwt({ sub: '1', perfil: 'Dono', exp: exp() }))
    expect(adminLogado()).toBeNull()

    setAdminToken(jwt({ sub: '1', escopo: 'plataforma', exp: Math.floor(Date.now() / 1000) - 10 }))
    expect(adminLogado()).toBeNull()

    setAdminToken(jwt({ sub: '1', escopo: 'plataforma', email: 'equipe@agesto.app', exp: exp() }))
    expect(adminLogado()?.email).toBe('equipe@agesto.app')
  })

  it('com token de admin, lista as empresas clientes', async () => {
    setAdminToken(jwt({ sub: '1', escopo: 'plataforma', name: 'Equipe', exp: exp() }))
    get.mockResolvedValue([
      {
        id: 3, nome: 'Hidráulica Rápida', documento: null, ativa: false, createdAt: '2026-08-01T00:00:00Z',
        totalUsuarios: 2, usuariosAtivos: 1, donoNome: 'Marcos', donoEmail: 'marcos@h.com', ultimoAcessoEm: null,
        pagoAte: '2026-10-20', licencasFuncionarios: 1, situacaoAssinatura: 'Atrasada', diasParaVencer: null, diasDeAtraso: 24,
      },
    ])

    emRotas('/admin')

    expect(await screen.findByText('Hidráulica Rápida')).toBeInTheDocument()
    expect(screen.getByText('Bloqueada')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 ativos')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/api/admin/empresas')
  })
})
