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
  return enviado.erros.length > 0
    ? `${enviados} ${enviado.erros.length} não enviado(s), seguem pendentes: ${enviado.erros[0]}`
    : `${enviados} ${agenda}`
}
