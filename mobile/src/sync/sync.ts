import { api } from '@/lib/api'
import { db } from '@/db/instance'
import { saveConfig } from '@/lib/appConfig'
import { saveSugeridos } from '@/lib/sugeridos'
import type { LocalAtendimento, LocalDb } from '@/db/types'
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
  /** Itens de agenda que vieram na Carga; null se a API não mandou (versão anterior). */
  agenda: number | null
}

export interface SyncResult extends CargaResult {
  agenda: number
}

/** Quando a última Carga foi feita (sincronizadoEm do servidor); base da incremental. */
const META_CARGA = 'cargaEm'
/** Rede de segurança: depois disso a Carga volta a ser completa. */
export const CARGA_COMPLETA_A_CADA_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Carga: puxa dados de referência do servidor e grava no banco local.
 * `database` é injetável (default = singleton por plataforma) — testes passam
 * o adapter de memória diretamente.
 *
 * Incremental (PERF-01): com uma Carga recente, pede só o que mudou desde ela
 * (`ultimaSincronizacao`) e aplica linha a linha, apagando os ids que o servidor
 * diz que foram excluídos. Sem Carga anterior, depois de 7 dias ou se a API não
 * mandar a lista de excluídos (versão anterior), refaz a completa, que substitui
 * as tabelas inteiras. Os contadores são do que veio nesta Carga.
 */
export async function carga(database: LocalDb = db, agora = Date.now()): Promise<CargaResult> {
  const cargaEm = await database.getMeta(META_CARGA)
  if (cargaEm !== null && agora - (Date.parse(cargaEm) || 0) < CARGA_COMPLETA_A_CADA_MS) {
    const delta = await api.get<SyncCargaResponse>(
      `/api/sync/carga?ultimaSincronizacao=${encodeURIComponent(cargaEm)}`,
    )
    if (delta.removidos) {
      await database.mergeClientes(delta.clientes, delta.removidos.clientes)
      await database.mergeProdutos(delta.produtos, delta.removidos.produtos)
      await database.mergeServicos(delta.servicos, delta.removidos.servicos)
      return concluir(database, delta)
    }
  }

  const data = await api.get<SyncCargaResponse>('/api/sync/carga')
  await database.saveClientes(data.clientes)
  await database.saveProdutos(data.produtos)
  await database.saveServicos(data.servicos)
  return concluir(database, data)
}

/** Configuração, kits, agenda e histórico vêm inteiros nas duas Cargas (são pequenos). */
async function concluir(database: LocalDb, data: SyncCargaResponse): Promise<CargaResult> {
  if (data.configuracao) {
    await saveConfig(database, data.configuracao)
  }
  await saveSugeridos(database, data.sugeridos ?? [])
  if (data.agenda) await database.saveAgenda(data.agenda)
  if (data.historico) await database.saveHistorico(data.historico)
  await database.setMeta('lastSync', data.sincronizadoEm)
  await database.setMeta(META_CARGA, data.sincronizadoEm)

  return {
    clientes: data.clientes.length,
    produtos: data.produtos.length,
    servicos: data.servicos.length,
    agenda: data.agenda ? data.agenda.length : null,
  }
}

/**
 * Busca a agenda (GET /api/atendimento/agenda) e cacheia local. Só para API
 * antiga: a Carga atual já traz a agenda (e o histórico) no mesmo pedido.
 */
export async function syncAgenda(database: LocalDb = db): Promise<number> {
  const items = await api.get<AgendaItem[]>('/api/atendimento/agenda')
  await database.saveAgenda(items)
  return items.length
}

/** Sincronização inicial (login): dados de referência, agenda e histórico num pedido só. */
export async function initialSync(database: LocalDb = db): Promise<SyncResult> {
  const c = await carga(database)
  const agenda = c.agenda ?? (await syncAgenda(database))
  return { ...c, agenda }
}

const RECUSAS = 'recusas'

/** Motivo da recusa no último envio, pelo uuid (minúsculo) do que o servidor recusou. */
export type Recusas = Record<string, string>

export async function getRecusas(database: LocalDb = db): Promise<Recusas> {
  const raw = await database.getMeta(RECUSAS)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Recusas
  } catch {
    return {}
  }
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Por que o atendimento não entrou no último envio, ou null (I2). Quando quem
 * não entrou foi o cliente ou o serviço novo dele, mostra esse motivo, que é o
 * que o agente precisa corrigir.
 */
export function motivoDaRecusa(
  a: Pick<LocalAtendimento, 'uuid' | 'clienteUuid' | 'itensServico'>,
  recusas: Recusas,
): string | null {
  const cliente = a.clienteUuid ? recusas[a.clienteUuid.toLowerCase()] : undefined
  if (cliente) return `Cliente não aceito: ${cliente}`
  for (const it of a.itensServico) {
    const servico = it.servicoUuid ? recusas[it.servicoUuid.toLowerCase()] : undefined
    if (servico) return `Serviço novo não aceito: ${servico}`
  }
  const proprio = recusas[a.uuid.toLowerCase()]
  return proprio ? maiuscula(proprio) : null
}

export interface DescargaResult {
  clientesImportados: number
  servicosImportados: number
  atendimentosImportados: number
  /** Atendimentos do servidor (ex.: agendados pelo Dono) concluídos no app. */
  conclusoesImportadas: number
  erros: string[]
}

/**
 * Descarga: empurra clientes, serviços e atendimentos criados offline e marca
 * como sincronizados só os que o servidor aceitou; os rejeitados seguem pendentes.
 */
export async function descarga(database: LocalDb = db): Promise<DescargaResult> {
  const clientesPend = (await database.getPendingClientes()).filter((c) => c.syncedAt === null)
  const servicosPend = (await database.getPendingServicos()).filter((s) => s.syncedAt === null)
  const atendPend = await database.getPendingAtendimentos()

  if (clientesPend.length === 0 && servicosPend.length === 0 && atendPend.length === 0) {
    await database.setMeta(RECUSAS, '{}')
    return { clientesImportados: 0, servicosImportados: 0, atendimentosImportados: 0, conclusoesImportadas: 0, erros: [] }
  }

  const body: SyncDescargaRequest = {
    clientes: clientesPend.map((c) => ({
      uuid: c.uuid, nome: c.nome, telefone: c.telefone, cpf: c.cpf, logradouro: c.logradouro,
      numero: c.numero, bairro: c.bairro, cidade: c.cidade, cep: c.cep,
    })),
    servicos: servicosPend.map((s) => ({
      uuid: s.uuid, descricao: s.descricao, tipoCobranca: s.tipoCobranca,
      valorHora: s.valorHora, valorEmpreitada: s.valorEmpreitada,
    })),
    atendimentos: atendPend.filter((a) => !a.existente).map((a) => ({
      uuid: a.uuid, dataRegistro: a.dataRegistro, dataAgendada: a.dataAgendada,
      status: a.status, clienteId: a.clienteId, clienteUuid: a.clienteUuid ?? null,
      itensProduto: a.itensProduto, itensServico: a.itensServico,
    })),
    conclusoes: atendPend.filter((a) => a.existente).map((a) => ({
      uuid: a.uuid, status: a.status, itensProduto: a.itensProduto, itensServico: a.itensServico,
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

  // Mesmo religamento para serviços criados offline (ou reaproveitados pela descrição).
  const servicoLocal = new Map(servicosPend.map((s) => [s.uuid.toLowerCase(), s.uuid]))
  for (const m of res.servicosMapeados ?? []) {
    const local = servicoLocal.get(m.uuid.toLowerCase())
    if (local) await database.remapServico(local, m.id)
  }

  // Servidor devolve Guid; compara sem diferenciar caixa.
  const aceitos = (uuids: string[] | undefined) => new Set((uuids ?? []).map((u) => u.toLowerCase()))
  const clientesOk = aceitos(res.clientesSincronizados)
  const servicosOk = aceitos(res.servicosSincronizados)
  const atendOk = aceitos([...(res.atendimentosSincronizados ?? []), ...(res.conclusoesSincronizadas ?? [])])

  await database.markClientesSynced(
    clientesPend.map((c) => c.uuid).filter((u) => clientesOk.has(u.toLowerCase())),
    res.sincronizadoEm,
  )
  await database.markServicosSynced(
    servicosPend.map((s) => s.uuid).filter((u) => servicosOk.has(u.toLowerCase())),
    res.sincronizadoEm,
  )
  await database.markSynced(
    atendPend.map((a) => a.uuid).filter((u) => atendOk.has(u.toLowerCase())),
    res.sincronizadoEm,
  )
  await database.setMeta('lastSync', res.sincronizadoEm)

  // Motivo de cada recusa, para a lista de atendimentos mostrar em cada pendente.
  const recusas: Recusas = {}
  for (const r of res.recusas ?? []) {
    const k = r.uuid.toLowerCase()
    recusas[k] = recusas[k] ? `${recusas[k]} ${r.motivo}` : r.motivo
  }
  await database.setMeta(RECUSAS, JSON.stringify(recusas))

  return {
    clientesImportados: res.clientesImportados,
    servicosImportados: res.servicosImportados ?? 0,
    atendimentosImportados: res.atendimentosImportados,
    conclusoesImportadas: res.conclusoesImportadas ?? 0,
    erros: res.erros,
  }
}

export interface SincronizacaoResult {
  enviado: DescargaResult
  recebido: SyncResult
}

/**
 * Sincronização completa: envia o que está pendente (se houver) e sempre baixa
 * a Carga e a agenda, para o que o Dono criou no web chegar ao app mesmo sem
 * nada a enviar.
 */
export async function sincronizar(database: LocalDb = db): Promise<SincronizacaoResult> {
  const enviado = await descarga(database)
  const recebido = await initialSync(database)
  return { enviado, recebido }
}

/** Resumo de uma sincronização para mostrar ao agente. */
export function resumoSincronizacao({ enviado, recebido }: SincronizacaoResult): string {
  const agenda = `Agenda de hoje: ${recebido.agenda} visita${recebido.agenda === 1 ? '' : 's'}.`
  const atendimentos = enviado.atendimentosImportados + enviado.conclusoesImportadas
  const nada = atendimentos + enviado.clientesImportados + enviado.servicosImportados === 0
  if (nada && enviado.erros.length === 0) return `Dados atualizados. ${agenda}`
  const servicos = enviado.servicosImportados > 0 ? `, ${enviado.servicosImportados} serviço(s) novo(s)` : ''
  const enviados = `Enviados: ${atendimentos} atendimento(s), ${enviado.clientesImportados} cliente(s)${servicos}.`
  const n = enviado.erros.length
  const outros = n > 1 ? ` O motivo de cada um aparece em Atendimentos.` : ''
  return n > 0
    ? `${enviados} ${n} não enviado(s), seguem pendentes: ${enviado.erros[0]}${outros}`
    : `${enviados} ${agenda}`
}
