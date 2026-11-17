import { http, HttpResponse } from 'msw'
import { ok, fail } from '../lib/http'
import type { AssuntoTicket, StatusTicket, Ticket } from '../../types/api'

/** Chamados de suporte no modo de demonstração (DEC-60): painel do Dono e superadmin. */
const agora = Date.now()
const iso = (horasAtras: number) => new Date(agora - horasAtras * 3_600_000).toISOString()

let nextId = 3
const tickets: Ticket[] = [
  {
    id: 2,
    assunto: 'Duvida',
    status: 'EmAndamento',
    mensagem: 'Como faço para o agente ver só a agenda dele no app?',
    totalRespostas: 1,
    createdAt: iso(30),
    updatedAt: iso(4),
    resolvidoEm: null,
    empresaId: 1,
    empresaNome: 'Clima Bom Instalações',
    donoNome: 'Fernando',
    donoEmail: 'dono@agesto.app',
    respostas: [
      {
        id: 1,
        mensagem: 'Oi, Fernando! Em Parametrização, escolha "Agenda só do agente". Já deixamos anotado para conferir com você.',
        autor: 'Ana',
        createdAt: iso(4),
      },
    ],
  },
  {
    id: 1,
    assunto: 'Melhoria',
    status: 'Resolvido',
    mensagem: 'Seria ótimo mandar o orçamento em PDF pelo WhatsApp.',
    totalRespostas: 1,
    createdAt: iso(200),
    updatedAt: iso(150),
    resolvidoEm: iso(150),
    empresaId: 1,
    empresaNome: 'Clima Bom Instalações',
    donoNome: 'Fernando',
    donoEmail: 'dono@agesto.app',
    respostas: [{ id: 2, mensagem: 'Feito! O orçamento já sai em PDF.', autor: 'Ana', createdAt: iso(150) }],
  },
]

const resumo = (t: Ticket): Ticket => ({ ...t, respostas: null })
const doDono = (t: Ticket): Ticket => ({ ...t, empresaId: null, empresaNome: null, donoNome: null, donoEmail: null })

function ordenar(lista: Ticket[]) {
  return [...lista].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function aplicarStatus(t: Ticket, status: StatusTicket) {
  t.status = status
  t.resolvidoEm = status === 'Resolvido' ? (t.resolvidoEm ?? new Date().toISOString()) : null
  t.updatedAt = new Date().toISOString()
}

export const suporteHandlers = [
  http.get('*/api/suporte', () => HttpResponse.json(ok(ordenar(tickets).map(resumo).map(doDono), 'Chamados.'))),

  http.get('*/api/suporte/:id', ({ params }) => {
    const t = tickets.find((x) => x.id === Number(params.id))
    return t ? HttpResponse.json(ok(doDono(t), 'Chamado.')) : fail(404, 'Chamado não encontrado.')
  }),

  http.post('*/api/suporte', async ({ request }) => {
    const form = await request.formData()
    const b = { assunto: form.get('assunto') as AssuntoTicket, mensagem: String(form.get('mensagem') ?? '') }
    const arquivos = form.getAll('anexos').filter((x): x is File => x instanceof File)
    const mensagem = (b.mensagem ?? '').trim()
    if (mensagem.length < 10) return fail(400, 'Escreva pelo menos 10 caracteres.')
    const t: Ticket = {
      id: nextId++,
      assunto: b.assunto,
      status: 'Aberto',
      mensagem,
      totalRespostas: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvidoEm: null,
      empresaId: 1,
      empresaNome: 'Clima Bom Instalações',
      donoNome: 'Fernando',
      donoEmail: 'dono@agesto.app',
      respostas: [],
      totalAnexos: arquivos.length,
      // Na demonstração o anexo abre direto do navegador (na API é um link temporário do Storage).
      anexos: arquivos.map((f, i) => ({
        id: Date.now() + i,
        nomeArquivo: f.name,
        contentType: f.type,
        tamanho: f.size,
        url: URL.createObjectURL(f),
      })),
    }
    tickets.push(t)
    return HttpResponse.json(ok(doDono(t), 'Chamado aberto. Enviamos uma cópia para o seu email.'), { status: 201 })
  }),

  http.get('*/api/admin/suporte', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const lista = tickets.filter((t) => !status || t.status === status)
    return HttpResponse.json(ok(ordenar(lista).map(resumo), 'Chamados.'))
  }),

  http.get('*/api/admin/suporte/:id', ({ params }) => {
    const t = tickets.find((x) => x.id === Number(params.id))
    return t ? HttpResponse.json(ok(t, 'Chamado.')) : fail(404, 'Chamado não encontrado.')
  }),

  http.post('*/api/admin/suporte/:id/respostas', async ({ params, request }) => {
    const b = (await request.json()) as { mensagem: string; status?: StatusTicket }
    const t = tickets.find((x) => x.id === Number(params.id))
    if (!t) return fail(404, 'Chamado não encontrado.')
    if (!b.mensagem?.trim()) return fail(400, 'Escreva a resposta.')
    t.respostas = [...(t.respostas ?? []), { id: Date.now(), mensagem: b.mensagem.trim(), autor: 'Ana', createdAt: new Date().toISOString() }]
    t.totalRespostas = t.respostas.length
    aplicarStatus(t, b.status ?? (t.status === 'Aberto' ? 'EmAndamento' : t.status))
    return HttpResponse.json(ok(t, 'Resposta enviada ao Dono.'))
  }),

  http.put('*/api/admin/suporte/:id/status', async ({ params, request }) => {
    const b = (await request.json()) as { status: StatusTicket }
    const t = tickets.find((x) => x.id === Number(params.id))
    if (!t) return fail(404, 'Chamado não encontrado.')
    aplicarStatus(t, b.status)
    return HttpResponse.json(ok(t, 'Status atualizado.'))
  }),
]
