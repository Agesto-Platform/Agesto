import type { AgendaItem, Cliente, ClienteInput, Produto, Servico, StatusAtendimento } from '@/types/api'

/** Cliente criado no device (offline). `syncedAt` null = pendente de envio. */
export interface PendingCliente extends ClienteInput {
  uuid: string
  syncedAt: string | null
}

/**
 * Atendimento criado no device (offline-first). `syncedAt` null = pendente de
 * envio. Itens só de catálogo por quantidade (contrato enxuto da Descarga).
 */
export interface LocalAtendimento {
  uuid: string
  /** Id do servidor; null enquanto o cliente foi criado offline e não sincronizou. */
  clienteId: number | null
  /** UUID do cliente criado offline (PendingCliente), resolvido na Descarga. */
  clienteUuid?: string | null
  status: StatusAtendimento
  dataRegistro: string
  /** Data agendada (futuro) — null quando é registro imediato. */
  dataAgendada: string | null
  itensProduto: { produtoId: number; quantidade: number }[]
  itensServico: { servicoId: number; quantidade: number }[]
  syncedAt: string | null
}

/**
 * Banco local offline-first. Dois adapters (expo-sqlite no device / memória no
 * web e testes) implementam esta interface — a app não sabe qual está usando.
 */
export interface LocalDb {
  init(): Promise<void>

  // dados de referência (substituídos em bloco pela Carga)
  saveClientes(items: Cliente[]): Promise<void>
  saveProdutos(items: Produto[]): Promise<void>
  saveServicos(items: Servico[]): Promise<void>
  saveAgenda(items: AgendaItem[]): Promise<void>
  getClientes(): Promise<Cliente[]>
  getProdutos(): Promise<Produto[]>
  getServicos(): Promise<Servico[]>
  getAgenda(): Promise<AgendaItem[]>

  // clientes criados offline
  addCliente(c: PendingCliente): Promise<void>
  getPendingClientes(): Promise<PendingCliente[]>
  markClientesSynced(uuids: string[], syncedAt: string): Promise<void>

  // atendimentos criados offline
  addAtendimento(a: LocalAtendimento): Promise<void>
  getAtendimentos(): Promise<LocalAtendimento[]>
  getPendingAtendimentos(): Promise<LocalAtendimento[]>
  markSynced(uuids: string[], syncedAt: string): Promise<void>
  /** Religa atendimentos do cliente criado offline ao id que o servidor atribuiu. */
  remapCliente(clienteUuid: string, clienteId: number): Promise<void>

  // metadados (ex.: última sincronização)
  getMeta(key: string): Promise<string | null>
  setMeta(key: string, value: string): Promise<void>

  reset(): Promise<void>
}
