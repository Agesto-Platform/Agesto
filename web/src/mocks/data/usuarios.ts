import { http, HttpResponse } from 'msw'
import type {
  PerfilUsuario,
  Usuario,
  UsuarioConvite,
  UsuarioCreateInput,
  UsuarioUpdateInput,
} from '../../types/api'
import { ok, fail } from '../lib/http'
import { DEMO_EMAIL } from './auth'

let nextId = 4
const agora = new Date().toISOString()

/** Usuários da empresa demo. O id 1 é o Dono logado no mock (sub do JWT). */
const usuarios: Usuario[] = [
  { id: 1, nome: 'Fernando', email: DEMO_EMAIL, perfil: 'Dono', ativo: true, deveTrocarSenha: false, ultimoAcessoEm: agora, createdAt: agora },
  { id: 2, nome: 'Carlos', email: 'carlos@agesto.app', perfil: 'Agente', ativo: true, deveTrocarSenha: false, ultimoAcessoEm: agora, createdAt: agora },
  // Recebeu o convite por email e ainda não criou a senha (DEC-55).
  { id: 3, nome: 'Bruna', email: 'bruna@agesto.app', perfil: 'Agente', ativo: true, deveTrocarSenha: false, convitePendente: true, ultimoAcessoEm: null, createdAt: agora },
]

function donosAtivos(): number {
  return usuarios.filter((u) => u.perfil === 'Dono' && u.ativo).length
}

export const usuarioHandlers = [
  http.get('*/api/usuario', () => HttpResponse.json(ok(usuarios, 'Usuarios encontrados.'))),

  http.post('*/api/usuario/:id/desativar', ({ params }) => {
    const u = usuarios.find((x) => x.id === Number(params.id))
    if (!u) return fail(404, 'Usuario nao encontrado.')
    if (u.id === 1) return fail(409, 'Voce nao pode desativar o seu proprio acesso.')
    if (u.perfil === 'Dono' && donosAtivos() <= 1) return fail(409, 'A empresa precisa de pelo menos um Dono ativo.')
    u.ativo = false
    return HttpResponse.json(ok(u, 'Usuario desativado.'))
  }),

  http.post('*/api/usuario/:id/reativar', ({ params }) => {
    const u = usuarios.find((x) => x.id === Number(params.id))
    if (!u) return fail(404, 'Usuario nao encontrado.')
    u.ativo = true
    return HttpResponse.json(ok(u, 'Usuario reativado.'))
  }),

  http.post('*/api/usuario/:id/reenviar-convite', ({ params }) => {
    const u = usuarios.find((x) => x.id === Number(params.id))
    if (!u) return fail(404, 'Usuário não encontrado.')
    if (!u.convitePendente) return fail(409, 'Esta pessoa já criou a senha. Se esqueceu, ela pode usar "Esqueci a senha".')
    if (!u.ativo) return fail(409, 'Reative o acesso antes de reenviar o convite.')
    const data: UsuarioConvite = { usuario: u, envioHabilitado: true }
    return HttpResponse.json(ok(data, 'Convite reenviado.'))
  }),

  http.post('*/api/usuario', async ({ request }) => {
    const b = (await request.json()) as UsuarioCreateInput
    const email = b.email.trim().toLowerCase()
    if (usuarios.some((u) => u.email === email)) return fail(409, 'Email ja cadastrado.')
    const u: Usuario = {
      id: nextId++,
      nome: b.nome.trim(),
      email,
      perfil: (b.perfil ?? 'Agente') as PerfilUsuario,
      ativo: true,
      deveTrocarSenha: false,
      convitePendente: true,
      ultimoAcessoEm: null,
      createdAt: new Date().toISOString(),
    }
    usuarios.push(u)
    const data: UsuarioConvite = { usuario: u, envioHabilitado: true }
    return HttpResponse.json(ok(data, 'Acesso criado. Enviamos o convite por email.'), { status: 201 })
  }),

  http.put('*/api/usuario/:id', async ({ request, params }) => {
    const b = (await request.json()) as UsuarioUpdateInput
    const u = usuarios.find((x) => x.id === Number(params.id))
    if (!u) return fail(404, 'Usuario nao encontrado.')
    if (u.perfil === 'Dono' && b.perfil !== 'Dono') {
      if (u.id === 1) return fail(409, 'Voce nao pode remover o seu proprio perfil de Dono.')
      if (u.ativo && donosAtivos() <= 1) return fail(409, 'A empresa precisa de pelo menos um Dono ativo.')
    }
    u.nome = b.nome.trim()
    u.perfil = b.perfil
    return HttpResponse.json(ok(u, 'Usuario atualizado com sucesso.'))
  }),

  http.post('*/api/auth/trocar-senha', () => HttpResponse.json(ok(null, 'Senha alterada com sucesso.'))),
]
