import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Pagina } from '../types/api'

/** PAG-01: as listas grandes vêm de 50 em 50, com "Carregar mais". */
export const TAMANHO_PAGINA = 50

export type Filtros = Record<string, string | number | null | undefined>

/** Monta `?pagina=&tamanho=&...`, sem os filtros vazios. */
export function urlDaPagina(path: string, pagina: number, filtros: Filtros): string {
  const params = new URLSearchParams({ pagina: String(pagina), tamanho: String(TAMANHO_PAGINA) })
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
  }
  return `${path}?${params.toString()}`
}

/**
 * Lista paginada no servidor, de 50 em 50. A chave fica sob a da lista do recurso
 * (ex.: ['cliente', 'list']), então as mutações que invalidam a lista também
 * recarregam as páginas. `itens` junta as páginas, sem repetir id.
 */
export function useListaPaginada<T extends { id: number }>(
  key: readonly unknown[],
  path: string,
  filtros: Filtros,
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: [...key, 'pagina', filtros],
    queryFn: ({ pageParam }) => api.get<Pagina<T>>(urlDaPagina(path, pageParam, filtros)),
    initialPageParam: 1,
    getNextPageParam: (ultima, todas) =>
      todas.reduce((n, p) => n + p.itens.length, 0) < ultima.total && ultima.itens.length > 0
        ? ultima.pagina + 1
        : undefined,
    enabled,
  })

  const itens = useMemo(() => {
    const vistos = new Set<number>()
    const lista: T[] = []
    for (const p of query.data?.pages ?? []) {
      for (const it of p.itens) {
        if (!vistos.has(it.id)) {
          vistos.add(it.id)
          lista.push(it)
        }
      }
    }
    return lista
  }, [query.data])

  const total = query.data?.pages.at(-1)?.total ?? 0
  return { ...query, itens, total }
}

/** Quantas opções um campo de escolha mostra por busca (PAG-01 fase 2). */
export const TAMANHO_BUSCA = 20

/**
 * Primeira página de uma busca no servidor, para os campos de escolha (cliente,
 * produto, serviço). Fica sob a chave da lista do recurso: criar ou editar um
 * item recarrega as opções.
 */
export function useBuscaRapida<T>(
  key: readonly unknown[],
  path: string,
  busca: string,
  enabled = true,
  filtros: Filtros = {},
) {
  const termo = busca.trim()
  return useQuery({
    queryKey: [...key, 'busca', termo, filtros],
    queryFn: () => {
      const params = new URLSearchParams({ pagina: '1', tamanho: String(TAMANHO_BUSCA) })
      if (termo) params.set('busca', termo)
      for (const [k, v] of Object.entries(filtros)) {
        if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
      }
      return api.get<Pagina<T>>(`${path}?${params.toString()}`)
    },
    enabled,
    staleTime: 30_000,
  })
}

/** O valor só muda depois de `ms` sem mudanças: a busca não pede uma página a cada letra. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [atual, setAtual] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setAtual(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return atual
}
