import { http, HttpResponse } from 'msw'
import type { AcaoAgente, AgentePerguntaRequest, AgenteResposta, AgenteUso } from '../../types/api'
import { ok, fail } from '../lib/http'
import { atendimentos, resumo } from './atendimentos'
import { clienteStore } from './clientes'

/** Respostas de exemplo do Agente (mock): sem IA, só para navegar o painel. */
function responder(pergunta: string): string {
  const p = pergunta.toLowerCase()
  if (p.includes('sobrou')) return 'Neste mês sobraram R$ 14.240,00 de margem, sobre R$ 18.450,00 faturados.'
  if (p.includes('margem')) return 'Instalação de split foi o serviço que mais rendeu: R$ 8.100,00 em 18 atendimentos.'
  if (p.includes('amanhã') || p.includes('amanha')) return 'Amanhã você tem 2 atendimentos:\n- 09:00 Instalação de split\n- 14:30 Limpeza e higienização'
  if (p.includes('acabando')) return 'O Gás R410A está acabando: restam 6 kg, o que dá cerca de 4 dias no ritmo atual.'
  if (p.includes('devendo')) return 'Você tem R$ 1.250,00 a receber em 3 atendimentos. O mais antigo é do Fernando Lima: R$ 680,00, há 18 dias. Preparei uma mensagem de cobrança para ele.'
  if (p.includes('reagend') || p.includes('remarc'))
    return 'Propus passar o próximo atendimento pendente para daqui a 3 dias, às 09:00, com o Carlos. Confira no cartão e confirme se estiver certo.'
  if (p.includes('orçamento') || p.includes('orcamento')) return 'Há 2 orçamentos enviados sem resposta há mais de 7 dias, somando R$ 3.400,00. O maior é da Clínica Sorriso: R$ 2.600,00, há 12 dias.'
  return 'Esta é uma resposta de exemplo do modo de demonstração. Com a API real, o Agente responde com os números da sua empresa.'
}

/** Rascunho de WhatsApp de exemplo (KAN-77): na API, o telefone vem do cadastro do cliente. */
function acoes(pergunta: string): AcaoAgente[] {
  const p = pergunta.toLowerCase()
  if (p.includes('reagend') || p.includes('remarc')) return proposta()
  if (!p.includes('devendo')) return []
  return [
    {
      tipo: 'whatsapp',
      clienteId: 1,
      clienteNome: 'Fernando Lima',
      telefone: '11987654321',
      mensagem: 'Olá, Fernando! Tudo bem? Passando para lembrar do pagamento de R$ 680,00 da instalação do dia 05/11. Qualquer dúvida, é só chamar.',
    },
  ]
}

/** Proposta de exemplo (DEC-63): reagenda o primeiro pendente; nada muda até o Dono confirmar. */
function proposta(): AcaoAgente[] {
  const at = atendimentos.find((a) => a.status === 'Pendente')
  if (!at) return []
  const n = new Date()
  const novaData = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 3, 9).toISOString()
  return [
    {
      tipo: 'atendimento',
      clienteId: at.clienteId,
      clienteNome: clienteStore.get(at.clienteId)?.nome ?? 'Cliente',
      atendimentoId: at.id,
      servico: resumo(at.id),
      dataAtual: at.dataAgendada,
      responsavelAtualId: at.usuarioId,
      responsavelAtualNome: at.usuarioId === 2 ? 'Carlos' : 'Fernando',
      novoStatus: null,
      novaData,
      novoResponsavelId: at.usuarioId === 2 ? null : 2,
      novoResponsavelNome: at.usuarioId === 2 ? null : 'Carlos',
    },
  ]
}

/** Limite diário por empresa (DEC-21), contado só nesta aba no modo de demonstração. */
const LIMITE = 20
let usadas = 0

export const agenteHandlers = [
  http.get('*/api/agente/uso', () => {
    const data: AgenteUso = { limite: LIMITE, usadas, restantes: LIMITE - usadas }
    return HttpResponse.json(ok(data, 'Uso do Agente hoje.'))
  }),
  http.post('*/api/agente/perguntar', async ({ request }) => {
    const body = (await request.json()) as AgentePerguntaRequest
    if (!body.pergunta?.trim()) return fail(400, 'Pergunta obrigatória.')
    if (usadas >= LIMITE) return fail(429, `Sua empresa já fez as ${LIMITE} perguntas de hoje ao Agente. O limite recomeça amanhã.`)
    usadas++
    const data: AgenteResposta = {
      resposta: responder(body.pergunta),
      modelo: 'mock',
      perguntasRestantes: LIMITE - usadas,
      limiteDiario: LIMITE,
      acoes: acoes(body.pergunta),
    }
    return HttpResponse.json(ok(data, 'Resposta do Agente.'))
  }),
]
