import { describe, it, expect } from 'vitest'
import { responsaveis, nomeUsuario } from './queries'
import type { Usuario } from '../../types/api'

const u = (id: number, nome: string, perfil: Usuario['perfil'], ativo = true): Usuario => ({
  id, nome, email: `${id}@t.com`, perfil, ativo, deveTrocarSenha: false, ultimoAcessoEm: null, createdAt: '',
})

describe('responsaveis', () => {
  it('lista só ativos, agentes antes do dono, em ordem alfabética', () => {
    const lista = responsaveis([u(1, 'Fernando', 'Dono'), u(2, 'Zé', 'Agente'), u(3, 'Ana', 'Agente'), u(4, 'Bia', 'Agente', false)])
    expect(lista.map((x) => x.nome)).toEqual(['Ana', 'Zé', 'Fernando'])
  })
})

describe('nomeUsuario', () => {
  it('cai num rótulo legível quando o id não está na lista', () => {
    expect(nomeUsuario([u(1, 'Fernando', 'Dono')], 1)).toBe('Fernando')
    expect(nomeUsuario(undefined, 9)).toBe('Usuário #9')
  })
})
