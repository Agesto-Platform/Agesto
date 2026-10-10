import { api } from '@/lib/api'
import { db } from '@/db/instance'
import { saveConfig } from '@/lib/appConfig'
import { saveSugeridos } from '@/lib/sugeridos'
import type { LocalDb } from '@/db/types'
import type {
  AgendaItem,
  SyncCargaResponse,
  SyncDescargaRequest,
  SyncDescargaResponse,
} from '@/types/api'

export interface CargaResult {
  clientes: number
  produtos: number
  servicos: number
}

export interface SyncResult extends CargaResult {
  agenda: number
}

/**
 * Carga: puxa dados de referência do servidor e grava no banco local.
 * `database` é injetável (default = singleton por plataforma) — testes passam
 * o adapter de memória diretamente.
 *
 * Sempre completa (sem `ultimaSincronizacao`): os saves locais substituem a
 * tabela inteira, então um delta apagaria o que não mudou. A Carga completa
 * também propaga exclusões (soft delete) do servidor para o device.
 */
export async function carga(database: LocalDb = db): Promise<CargaResult> {
  const data = await api.get<SyncCargaResponse>('/api/sync/carga')

  await database.saveClientes(data.clientes)
  await database.saveProdutos(data.produtos)
  await database.saveServicos(data.servicos)
  if (data.configuracao) {
    await saveConfig(database, data.configuracao)
  }
  await saveSugeridos(database, data.sugeridos ?? [])
  await database.setMeta('lastSync', data.sincronizadoEm)

  return {
    clientes: data.clientes.length,
    produtos: data.produtos.length,
    servicos: data.servicos.length,
  }
}

/**
 * Busca a agenda do dia (GET /api/atendimento/agenda) e cacheia local.
 * NB: a Carga não inclui a agenda hoje — este passo cobre isso (delta de
 * backend: idealmente a agenda entraria na Carga para ficar 100% offline).
 */
export async function syncAgenda(database: LocalDb = db): Promise<number> {
  const items = await api.get<AgendaItem[]>('/api/atendimento/agenda')
  await database.saveAgenda(items)
  return items.length
}

/** Sincronização inicial (login): dados de referência + agenda do dia. */
export async function initialSync(database: LocalDb = db): Promise<SyncResult> {
  const c = await carga(database)
  const agenda = await syncAgenda(database)
  return { ...c, agenda }
}

export interface DescargaResult {
  clientesImportados: number
  atendimentosImportados: number
  erros: string[]
}

/**
 * Descarga: empurra clientes e atendimentos criados offline e marca como
 * sincronizados só os que o servidor aceitou; os rejeitados seguem pendentes.
 */
export async function descarga(database: LocalDb = db): Promise<DescargaResult> {
  const clientesPend = (await database.getPendingClientes()).filter((c) => c.syncedAt === null)
  const atendPend = await database.getPendingAtendimentos()

  if (clientesPend.length === 0 && atendPend.length === 0) {
    return { clientesImportados: 0, atendimentosImportados: 0, erros: [] }
  }

  const body: SyncDescargaRequest = {
    clientes: clientesPend.map((c) => ({
      uuid: c.uuid, nome: c.nome, telefone: c.telefone, cpf: c.cpf, logradouro: c.logradouro,
      numero: c.numero, bairro: c.bairro, cidade: c.cidade, cep: c.cep,
    })),
    atendimentos: atendPend.map((a) => ({
      uuid: a.uuid, dataRegistro: a.dataRegistro, dataAgendada: a.dataAgendada,
      status: a.status, clienteId: a.clienteId, clienteUuid: a.clienteUuid ?? null,
      itensProduto: a.itensProduto, itensServico: a.itensServico,
    })),
  }

  const res = await api.post<SyncDescargaResponse>('/api/sync/descarga', body)

  // Religa atendimentos de clientes criados offline ao id do servidor. Vale
  // também para os que foram rejeitados: no reenvio já vão com o id.
  const uuidLocal = new Map(clientesPend.map((c) => [c.uuid.toLowerCase(), c.uuid]))
  for (const m of res.clientesMapeados ?? []) {
    const local = uuidLocal.get(m.uuid.toLowerCase())
    if (local) await database.remapCliente(local, m.id)
  }

  // Servidor devolve Guid; compara sem diferenciar caixa.
  const aceitos = (uuids: string[] | undefined) => new Set((uuids ?? []).map((u) => u.toLowerCase()))
  const clientesOk = aceitos(res.clientesSincronizados)
  const atendOk = aceitos(res.atendimentosSincronizados)

  await database.markClientesSynced(
    clientesPend.map((c) => c.uuid).filter((u) => clientesOk.has(u.toLowerCase())),
    res.sincronizadoEm,
  )
  await database.markSynced(
    atendPend.map((a) => a.uuid).filter((u) => atendOk.has(u.toLowerCase())),
    res.sincronizadoEm,
  )
  await database.setMeta('lastSync', res.sincronizadoEm)

  return {
    clientesImportados: res.clientesImportados,
    atendimentosImportados: res.atendimentosImportados,
    erros: res.erros,
  }
}
