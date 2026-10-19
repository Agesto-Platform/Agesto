import type { AgendaItem, Cliente, Produto, Servico, SyncCargaResponse } from '@/types/api'

const clientes: Cliente[] = [
  { id: 1, uuid: 'c1', nome: 'Vó Joana', telefone: '(34) 99999-0000', cpf: '111.222.333-44', logradouro: 'R. das Acácias', numero: '120', bairro: 'Centro', cidade: 'Uberaba', cep: '38010-000' },
  { id: 2, uuid: 'c2', nome: 'Marina Alves', telefone: '(34) 98888-1010', cpf: '222.333.444-55', logradouro: 'Av. Leopoldino', numero: '45', bairro: 'Fabrício', cidade: 'Uberaba', cep: null },
  { id: 3, uuid: 'c3', nome: 'Renata Vieira', telefone: null, cpf: '333.444.555-66', logradouro: null, numero: null, bairro: null, cidade: 'Uberaba', cep: null },
]

const produtos: Produto[] = [
  { id: 1, uuid: 'p1', nome: 'Suporte universal', preco: 70, quantidadeEstoque: 16 },
  { id: 2, uuid: 'p2', nome: 'Gás R-410a (kg)', preco: 68, quantidadeEstoque: 3 },
  { id: 3, uuid: 'p3', nome: 'Cano de dreno (m)', preco: 22, quantidadeEstoque: 40 },
]

const servicos: Servico[] = [
  { id: 1, uuid: 's1', descricao: 'Instalação de AC', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 350 },
  { id: 2, uuid: 's2', descricao: 'Manutenção preventiva', tipoCobranca: 'PorHora', valorHora: 140, valorEmpreitada: null },
  { id: 3, uuid: 's3', descricao: 'Limpeza / higienização', tipoCobranca: 'PorHora', valorHora: 90, valorEmpreitada: null },
]

export function seedCarga(): SyncCargaResponse {
  return {
    clientes,
    produtos,
    servicos,
    // Instalação de AC (s1) costuma usar suporte (p1) ×2 e cano de dreno (p3) ×1.
    sugeridos: [
      { servicoId: 1, produtoId: 1, quantidadePadrao: 2 },
      { servicoId: 1, produtoId: 3, quantidadePadrao: 1 },
    ],
    configuracao: { tipoOperacao: 'Servico', modoAgendaAgente: 'Flexivel', controlaEstoque: true, agenteCadastraServico: true },
    sincronizadoEm: new Date().toISOString(),
  }
}

function hoje(hour: number, min = 0): string {
  const d = new Date()
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

/** Agenda do dia do agente (GET /api/atendimento/agenda). */
export function seedAgenda(): AgendaItem[] {
  return [
    { id: 101, dataAgendada: hoje(9, 0), status: 'Pendente', valorTotal: 1200, clienteId: 1, clienteNome: 'Vó Joana', clienteTelefone: '(34) 99999-0000', enderecoResumo: 'R. das Acácias, 120 — Centro', resumo: 'Instalação de ar-condicionado' },
    { id: 102, dataAgendada: hoje(11, 30), status: 'Pendente', valorTotal: 380, clienteId: 2, clienteNome: 'Marina Alves', clienteTelefone: '(34) 98888-1010', enderecoResumo: 'Av. Leopoldino, 45 — Fabrício', resumo: 'Manutenção preventiva' },
    { id: 103, dataAgendada: hoje(15, 0), status: 'Pendente', valorTotal: 1640, clienteId: 3, clienteNome: 'Renata Vieira', clienteTelefone: null, enderecoResumo: 'Centro', resumo: 'Orçamento — troca de compressor' },
  ]
}
