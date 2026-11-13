import { http, HttpResponse } from 'msw'
import type { AgentePerguntaRequest, AgenteResposta, AgenteUso } from '../../types/api'
import { ok, fail } from '../lib/http'

/** Respostas de exemplo do Agente (mock): sem IA, só para navegar o painel. */
function responder(pergunta: string): string {
  const p = pergunta.toLowerCase()
  if (p.includes('sobrou')) return 'Neste mês sobraram R$ 14.240,00 de margem, sobre R$ 18.450,00 faturados.'
  if (p.includes('margem')) return 'Instalação de split foi o serviço que mais rendeu: R$ 8.100,00 em 18 atendimentos.'
  if (p.includes('amanhã') || p.includes('amanha')) return 'Amanhã você tem 2 atendimentos:\n- 09:00 Instalação de split\n- 14:30 Limpeza e higienização'
  if (p.includes('acabando')) return 'O Gás R410A está acabando: restam 6 kg, o que dá cerca de 4 dias no ritmo atual.'
  if (p.includes('orçamento') || p.includes('orcamento')) return 'Eu só consigo ler os dados. Para montar um orçamento, abra a tela Orçamentos no menu.'
  return 'Esta é uma resposta de exemplo do modo de demonstração. Com a API real, o Agente responde com os números da sua empresa.'
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
    }
    return HttpResponse.json(ok(data, 'Resposta do Agente.'))
  }),
]
