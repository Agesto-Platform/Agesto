import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { RelatoriosPage } from './RelatoriosPage'
import { dashboardMock } from '../../mocks/data/dashboard'
import { ApiError } from '../../lib/api'
import type { ShellContext } from '../../layout/AppShell'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: { get },
}))

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const contexto: ShellContext = { period: 'mes', setPeriod: vi.fn(), entradaPronta: vi.fn() }
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={contexto} />}>
            <Route index element={<RelatoriosPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RelatoriosPage', () => {
  // Com chaves: uma função devolvida pelo beforeEach vira limpeza e o Vitest a chama
  // depois do teste; get() rejeitado ali derrubava o teste de erro.
  beforeEach(() => {
    get.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra a receita e a margem por hora de cada serviço (KAN-29)', async () => {
    get.mockResolvedValue(dashboardMock)
    renderizar()
    expect(await screen.findByText('Instalação de AC')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s178\/h · margem R\$\s133\/h/)).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/metrics\/dashboard\?de=.+&ate=.+/))
  })

  it('mostra o erro da API quando o relatório não carrega', async () => {
    get.mockRejectedValue(new ApiError(500, 'Falha no servidor'))
    renderizar()
    expect(await screen.findByText(/Não foi possível carregar o relatório: Falha no servidor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeDisabled()
  })

  it('exporta a planilha com a margem por serviço', async () => {
    get.mockResolvedValue(dashboardMock)
    let planilha: Blob | undefined
    URL.createObjectURL = vi.fn((b: Blob) => {
      planilha = b
      return 'blob:relatorio'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: /Exportar/ }))

    const csv = await planilha!.text()
    expect(csv).toContain('Serviço;Atendimentos;Receita;Receita por hora;Margem;Margem por hora')
    expect(csv).toContain('Instalação de AC;18;6400;177,78;4800;133,33')
  })
})
