import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { AssuntoTicket, Ticket } from '../../types/api'

const PATH = '/api/suporte'
const K = {
  lista: ['suporte', 'lista'] as const,
  ticket: (id: number) => ['suporte', 'ticket', id] as const,
}

/** Chamados da empresa do Dono, os mais recentes primeiro (DEC-60). */
export function useTickets() {
  return useQuery({ queryKey: K.lista, queryFn: () => api.get<Ticket[]>(PATH) })
}

/** Chamado com as respostas da equipe. */
export function useTicket(id: number | null) {
  return useQuery({
    queryKey: K.ticket(id ?? 0),
    queryFn: () => api.get<Ticket>(`${PATH}/${id}`),
    enabled: id !== null,
  })
}

/** Chamado novo em formulário (multipart), com os anexos já comprimidos. */
export function useCriarTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assunto, mensagem, anexos }: { assunto: AssuntoTicket; mensagem: string; anexos: File[] }) => {
      const form = new FormData()
      form.append('assunto', assunto)
      form.append('mensagem', mensagem)
      for (const f of anexos) form.append('anexos', f, f.name)
      return api.postForm<Ticket>(PATH, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suporte'] }),
  })
}
