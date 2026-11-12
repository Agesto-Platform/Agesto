import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from './api'
import { TAMANHO_PAGINA, urlDaPagina, useListaPaginada } from './paginacao'

afterEach(() => vi.restoreAllMocks())

describe('urlDaPagina', () => {
  it('monta página e tamanho e ignora filtros vazios', () => {
    expect(urlDaPagina('/api/cliente', 2, { busca: 'joão', status: undefined, clienteId: null, x: '' })).toBe(
      `/api/cliente?pagina=2&tamanho=${TAMANHO_PAGINA}&busca=jo%C3%A3o`,
    )
  })
})

describe('useListaPaginada (PAG-01)', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }

  it('junta as páginas sem repetir id e para quando chega no total', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({ itens: [{ id: 1 }, { id: 2 }], pagina: 1, tamanho: 2, total: 3 })
      .mockResolvedValueOnce({ itens: [{ id: 2 }, { id: 3 }], pagina: 2, tamanho: 2, total: 3 })

    const { result } = renderHook(() => useListaPaginada<{ id: number }>(['x', 'list'], '/api/x', { busca: 'a' }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.itens).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.total).toBe(3)

    await act(() => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.itens.map((i) => i.id)).toEqual([1, 2, 3]))
    expect(result.current.hasNextPage).toBe(false)
    expect(get).toHaveBeenNthCalledWith(2, `/api/x?pagina=2&tamanho=${TAMANHO_PAGINA}&busca=a`)
  })
})
