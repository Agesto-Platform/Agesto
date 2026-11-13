import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Assinatura } from '../../types/api'

/** Assinatura da empresa do Dono (DEC-58). Muda pouco: 5 minutos de cache. */
export function useAssinatura() {
  return useQuery({
    queryKey: ['assinatura'],
    queryFn: () => api.get<Assinatura>('/api/assinatura'),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
