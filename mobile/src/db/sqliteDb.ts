import * as SQLite from 'expo-sqlite'
import type { AgendaItem, Cliente, Produto, Servico } from '@/types/api'
import type { LocalDb, LocalAtendimento, PendingCliente } from './types'

type Row = { json: string }
type AtRow = { json: string; syncedAt: string | null }

/** Adapter SQLite (device). Dados de referência e atendimentos como JSON por linha. */
export function createSqliteDb(): LocalDb {
  let db: SQLite.SQLiteDatabase | null = null
  async function conn(): Promise<SQLite.SQLiteDatabase> {
    if (!db) db = await SQLite.openDatabaseAsync('agesto.db')
    return db
  }

  async function saveRef(table: string, items: { id: number }[]): Promise<void> {
    const d = await conn()
    await d.withTransactionAsync(async () => {
      await d.runAsync(`DELETE FROM ${table}`)
      for (const it of items) {
        await d.runAsync(`INSERT INTO ${table} (id, json) VALUES (?, ?)`, it.id, JSON.stringify(it))
      }
    })
  }
  async function getRef<T>(table: string): Promise<T[]> {
    const d = await conn()
    const rows = await d.getAllAsync<Row>(`SELECT json FROM ${table} ORDER BY id`)
    return rows.map((r) => JSON.parse(r.json) as T)
  }

  return {
    async init() {
      const d = await conn()
      await d.execAsync(`
        CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS servicos (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agenda (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pending_clientes (uuid TEXT PRIMARY KEY, json TEXT NOT NULL, syncedAt TEXT);
        CREATE TABLE IF NOT EXISTS atendimentos (uuid TEXT PRIMARY KEY, json TEXT NOT NULL, syncedAt TEXT);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `)
    },

    saveClientes: (items) => saveRef('clientes', items),
    saveProdutos: (items) => saveRef('produtos', items),
    saveServicos: (items) => saveRef('servicos', items),
    saveAgenda: (items) => saveRef('agenda', items),
    getClientes: () => getRef<Cliente>('clientes'),
    getProdutos: () => getRef<Produto>('produtos'),
    getServicos: () => getRef<Servico>('servicos'),
    getAgenda: () => getRef<AgendaItem>('agenda'),

    async addCliente(c) {
      const d = await conn()
      await d.runAsync(
        `INSERT OR REPLACE INTO pending_clientes (uuid, json, syncedAt) VALUES (?, ?, ?)`,
        c.uuid,
        JSON.stringify(c),
        c.syncedAt,
      )
    },
    async getPendingClientes() {
      const d = await conn()
      const rows = await d.getAllAsync<AtRow>(`SELECT json, syncedAt FROM pending_clientes`)
      return rows.map((r) => ({ ...(JSON.parse(r.json) as PendingCliente), syncedAt: r.syncedAt }))
    },
    async markClientesSynced(uuids, syncedAt) {
      const d = await conn()
      await d.withTransactionAsync(async () => {
        for (const uuid of uuids) {
          await d.runAsync(`UPDATE pending_clientes SET syncedAt = ? WHERE uuid = ?`, syncedAt, uuid)
        }
      })
    },

    async addAtendimento(a) {
      const d = await conn()
      await d.runAsync(
        `INSERT OR REPLACE INTO atendimentos (uuid, json, syncedAt) VALUES (?, ?, ?)`,
        a.uuid,
        JSON.stringify(a),
        a.syncedAt,
      )
    },
    async getAtendimentos() {
      const d = await conn()
      const rows = await d.getAllAsync<AtRow>(`SELECT json, syncedAt FROM atendimentos`)
      return rows.map((r) => ({ ...(JSON.parse(r.json) as LocalAtendimento), syncedAt: r.syncedAt }))
    },
    async getPendingAtendimentos() {
      const d = await conn()
      const rows = await d.getAllAsync<AtRow>(`SELECT json, syncedAt FROM atendimentos WHERE syncedAt IS NULL`)
      return rows.map((r) => ({ ...(JSON.parse(r.json) as LocalAtendimento), syncedAt: null }))
    },
    async markSynced(uuids, syncedAt) {
      const d = await conn()
      await d.withTransactionAsync(async () => {
        for (const uuid of uuids) {
          await d.runAsync(`UPDATE atendimentos SET syncedAt = ? WHERE uuid = ?`, syncedAt, uuid)
        }
      })
    },
    async remapCliente(clienteUuid, clienteId) {
      const d = await conn()
      const rows = await d.getAllAsync<{ uuid: string; json: string }>(`SELECT uuid, json FROM atendimentos`)
      await d.withTransactionAsync(async () => {
        for (const r of rows) {
          const a = JSON.parse(r.json) as LocalAtendimento
          if (a.clienteUuid !== clienteUuid) continue
          await d.runAsync(
            `UPDATE atendimentos SET json = ? WHERE uuid = ?`,
            JSON.stringify({ ...a, clienteId, clienteUuid: null }),
            r.uuid,
          )
        }
      })
    },

    async getMeta(key) {
      const d = await conn()
      const row = await d.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, key)
      return row?.value ?? null
    },
    async setMeta(key, value) {
      const d = await conn()
      await d.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, key, value)
    },

    async reset() {
      const d = await conn()
      await d.execAsync(`DELETE FROM clientes; DELETE FROM produtos; DELETE FROM servicos; DELETE FROM agenda; DELETE FROM pending_clientes; DELETE FROM atendimentos; DELETE FROM meta;`)
    },
  }
}
