import { http, HttpResponse } from 'msw'
import type { Configuracao, ConfiguracaoPatch } from '../../types/api'
import { ok } from '../lib/http'

const now = new Date().toISOString()

// Singleton por empresa. Seed em "Servico" (foco do produto).
let config: Configuracao = {
  id: 1,
  tipoOperacao: 'Servico',
  modoAgendaAgente: 'Flexivel',
  controlaEstoque: true,
  agenteCadastraServico: true,
  empresaId: 1,
  createdAt: now,
  updatedAt: now,
}

export const configuracaoHandlers = [
  http.get('*/api/configuracao', () => HttpResponse.json(ok(config, 'Configuração encontrada.'))),
  http.put('*/api/configuracao', async ({ request }) => {
    const body = (await request.json()) as ConfiguracaoPatch
    config = {
      ...config,
      ...(body.tipoOperacao !== undefined && { tipoOperacao: body.tipoOperacao }),
      ...(body.modoAgendaAgente !== undefined && { modoAgendaAgente: body.modoAgendaAgente }),
      ...(body.controlaEstoque !== undefined && { controlaEstoque: body.controlaEstoque }),
      ...(body.agenteCadastraServico !== undefined && { agenteCadastraServico: body.agenteCadastraServico }),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json(ok(config, 'Configuração atualizada.'))
  }),
]
