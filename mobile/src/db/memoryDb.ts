import type { AgendaItem, Cliente, Produto, Servico } from '@/types/api'
import type { LocalDb, LocalAtendimento, PendingCliente, PendingServico } from './types'
import { remapItensServico } from './remap'

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** Adapter em memória — usado no web (preview) e nos testes. Reseta ao recarregar. */
export function createMemoryDb(): LocalDb {
  let clientes: Cliente[] = []
  let produtos: Produto[] = []
  let servicos: Servico[] = []
  let agenda: AgendaItem[] = []
  let pendingClientes: PendingCliente[] = []
  let pendingServicos: PendingServico[] = []
  let atendimentos: LocalAtendimento[] = []
  const meta = new Map<string, string>()

  return {
    async init() {},

    async saveClientes(items) {
      clientes = clone(items)
    },
    async saveProdutos(items) {
      produtos = clone(items)
    },
    async saveServicos(items) {
      servicos = clone(items)
    },
    async saveAgenda(items) {
      agenda = clone(items)
    },
    async getClientes() {
      return clone(clientes)
    },
    async getProdutos() {
      return clone(produtos)
    },
    async getServicos() {
      return clone(servicos)
    },
    async getAgenda() {
      return clone(agenda)
    },

    async addCliente(c) {
      pendingClientes = [...pendingClientes.filter((x) => x.uuid !== c.uuid), clone(c)]
    },
    async getPendingClientes() {
      return clone(pendingClientes)
    },
    async markClientesSynced(uuids, syncedAt) {
      const set = new Set(uuids)
      pendingClientes = pendingClientes.map((c) =>
        set.has(c.uuid) ? { ...c, syncedAt } : c,
      )
    },

    async addServico(s) {
      pendingServicos = [...pendingServicos.filter((x) => x.uuid !== s.uuid), clone(s)]
    },
    async getPendingServicos() {
      return clone(pendingServicos)
    },
    async markServicosSynced(uuids, syncedAt) {
      const set = new Set(uuids)
      pendingServicos = pendingServicos.map((s) => (set.has(s.uuid) ? { ...s, syncedAt } : s))
    },
    async remapServico(servicoUuid, servicoId) {
      atendimentos = atendimentos.map((a) => remapItensServico(a, servicoUuid, servicoId) ?? a)
    },

    async addAtendimento(a) {
      atendimentos = [...atendimentos.filter((x) => x.uuid !== a.uuid), clone(a)]
    },
    async deleteAtendimento(uuid) {
      atendimentos = atendimentos.filter((a) => a.uuid !== uuid || a.syncedAt !== null)
    },
    async getAtendimentos() {
      return clone(atendimentos)
    },
    async getPendingAtendimentos() {
      return clone(atendimentos.filter((a) => a.syncedAt === null))
    },
    async markSynced(uuids, syncedAt) {
      const set = new Set(uuids)
      atendimentos = atendimentos.map((a) =>
        set.has(a.uuid) ? { ...a, syncedAt } : a,
      )
    },
    async remapCliente(clienteUuid, clienteId) {
      atendimentos = atendimentos.map((a) =>
        a.clienteUuid === clienteUuid ? { ...a, clienteId, clienteUuid: null } : a,
      )
    },

    async getMeta(key) {
      return meta.get(key) ?? null
    },
    async setMeta(key, value) {
      meta.set(key, value)
    },

    async reset() {
      clientes = []
      produtos = []
      servicos = []
      agenda = []
      pendingClientes = []
      pendingServicos = []
      atendimentos = []
      meta.clear()
    },
  }
}
