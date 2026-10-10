/**
 * Tipos espelhando os DTOs do backend (MicroERP.Api). camelCase; enums string.
 * São os dados de referência que a Carga traz para o device.
 */

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
  errors: string[]
}

export interface AuthResponse {
  token: string
  expiresAt: string
}

export type StatusAtendimento = 'Pendente' | 'Concluido' | 'Cancelado'
export type TipoCobranca = 'PorHora' | 'Empreitada'
export type StatusOrcamento = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado'
export type TipoOperacao = 'Venda' | 'Servico' | 'Hibrido'
/** Flexivel: agente registra e agenda em campo. Fixa: só executa a agenda do Dono. */
export type ModoAgendaAgente = 'Flexivel' | 'Fixa'

/** Configuração da empresa que o mobile precisa conhecer (vem na Carga). */
export interface Configuracao {
  tipoOperacao: TipoOperacao
  modoAgendaAgente: ModoAgendaAgente
  controlaEstoque: boolean
}

/** Material sugerido de um serviço (kit), achatado — vem na Carga. */
export interface ServicoSugerido {
  servicoId: number
  produtoId: number
  quantidadePadrao: number
}

export interface Cliente {
  id: number
  uuid: string
  nome: string
  telefone: string | null
  cpf: string
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  cep: string | null
}

/** Campos para criar um cliente (espelha ClienteCreateRequest). */
export interface ClienteInput {
  nome: string
  telefone: string | null
  cpf: string
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  cep: string | null
}

export interface Produto {
  id: number
  uuid: string
  nome: string
  preco: number
  quantidadeEstoque: number
}

export interface Servico {
  id: number
  uuid: string
  descricao: string
  tipoCobranca: TipoCobranca
  valorHora: number | null
  valorEmpreitada: number | null
}

/** Item de agenda enriquecido (GET /api/atendimento/agenda). */
export interface AgendaItem {
  id: number
  dataAgendada: string | null
  status: StatusAtendimento
  valorTotal: number
  clienteId: number
  clienteNome: string
  clienteTelefone: string | null
  enderecoResumo: string | null
  resumo: string
}

/* ---- Sincronização (Carga/Descarga) ---- */

export interface SyncCargaResponse {
  clientes: Cliente[]
  produtos: Produto[]
  servicos: Servico[]
  sugeridos?: ServicoSugerido[]
  configuracao?: Configuracao | null
  sincronizadoEm: string
}

/** Payload de atendimento offline (AtendimentoSyncRequest) — enxuto. */
export interface AtendimentoSyncRequest {
  uuid: string
  dataRegistro: string
  dataAgendada?: string | null
  status: StatusAtendimento
  /** Id do servidor, ou null quando o cliente foi criado offline (usa clienteUuid). */
  clienteId: number | null
  clienteUuid?: string | null
  itensProduto: { produtoId: number; quantidade: number }[]
  itensServico: { servicoId: number; quantidade: number }[]
}

/** Cliente pendente na Descarga: leva o UUID do device (idempotência). */
export interface ClienteSyncInput extends ClienteInput {
  uuid: string
}

export interface SyncDescargaRequest {
  clientes: ClienteSyncInput[]
  atendimentos: AtendimentoSyncRequest[]
}

export interface SyncDescargaResponse {
  atendimentosImportados: number
  clientesImportados: number
  /** UUIDs aceitos (importados ou já existentes). O resto segue pendente. */
  clientesSincronizados: string[]
  atendimentosSincronizados: string[]
  /** uuid do device -> id do servidor dos clientes criados offline. */
  clientesMapeados?: { uuid: string; id: number }[]
  erros: string[]
  sincronizadoEm: string
}
