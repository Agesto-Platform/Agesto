import type { Cliente } from '../../types/api'
import { onlyDigits } from '../../lib/masks'
import { makeStore, crudHandlers, type Store } from '../lib/http'

const now = new Date().toISOString()

const seed: Cliente[] = [
  {
    id: 1, uuid: crypto.randomUUID(), nome: 'Vó Joana', telefone: '(34) 99999-0000',
    cpf: '111.444.777-35', logradouro: 'R. das Acácias', numero: '120', bairro: 'Centro',
    cidade: 'Uberaba', cep: '38010-000', createdAt: now, updatedAt: now,
  },
  {
    id: 2, uuid: crypto.randomUUID(), nome: 'Marina Alves', telefone: '(34) 98888-1010',
    cpf: '529.982.247-25', logradouro: 'Av. Leopoldino', numero: '45', bairro: 'Fabrício',
    cidade: 'Uberaba', cep: '38065-000', createdAt: now, updatedAt: now,
  },
  {
    id: 3, uuid: crypto.randomUUID(), nome: 'Renata Vieira', telefone: null,
    cpf: '123.456.789-09', logradouro: null, numero: null, bairro: null,
    cidade: 'Uberaba', cep: null, createdAt: now, updatedAt: now,
  },
]

const store: Store<Cliente> = makeStore(seed)

/** Rejeita CPF já cadastrado (409), espelhando CpfAlreadyExistsException. */
function validateCpf(body: Record<string, unknown>, s: Store<Cliente>): string | null {
  const cpf = onlyDigits(String(body.cpf ?? ''))
  const dup = s.list().some((c) => onlyDigits(c.cpf) === cpf)
  return dup ? 'CPF já cadastrado para outro cliente.' : null
}

export const clienteHandlers = crudHandlers('/api/cliente', store, validateCpf)
