import { describe, it, expect } from 'vitest'
import { aRevisar } from './resource'
import type { Servico } from '../../types/api'

const base: Servico = {
  id: 1, uuid: 'u1', descricao: 'Instalação', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 350,
  revisado: true, criadoPorUsuarioId: null, criadoPorNome: null, createdAt: '', updatedAt: '',
}

describe('aRevisar', () => {
  it('lista só os serviços criados por agentes que o Dono ainda não revisou', () => {
    const doAgente = { ...base, id: 2, descricao: 'Dreno', revisado: false, criadoPorUsuarioId: 2, criadoPorNome: 'Carlos' }
    expect(aRevisar([base, doAgente]).map((s) => s.id)).toEqual([2])
  })

  it('aceita a lista ainda carregando', () => {
    expect(aRevisar(undefined)).toEqual([])
  })
})
