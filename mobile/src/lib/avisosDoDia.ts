import type { AgendaItem } from '@/types/api'
import type { LocalDb } from '@/db/types'

/**
 * Aviso no celular dos atendimentos pendentes do dia, a partir da agenda que já está
 * no aparelho (a Carga traz 14 dias): funciona sem internet. Às 7h de cada dia com
 * pendentes; se a sincronização de hoje acontecer depois das 7h, avisa na hora,
 * uma vez por dia. Nunca lança: aviso não pode atrapalhar a sincronização.
 */

export const HORA_DO_AVISO = 7
/** Identificador das notificações do Agesto: as antigas são trocadas a cada sincronização. */
export const PREFIXO_AVISO = 'agesto-dia-'
const CANAL = 'agenda'
const META_AVISADO = 'avisoDoDiaEm'
const MAX_LINHAS = 3

type Notificacoes = typeof import('expo-notifications')
let modulo: Notificacoes | null | undefined

/**
 * O módulo nativo só existe no APK que já o inclui; num app antigo (ou nos testes),
 * fica sem aviso em vez de quebrar.
 */
export function notificacoes(): Notificacoes | null {
  if (modulo !== undefined) return modulo
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require('expo-notifications') as Notificacoes
  } catch {
    modulo = null
  }
  return modulo
}

export interface AvisoDoDia {
  /** "2026-11-14", dia local. */
  dia: string
  /** null = agora (sincronizou depois das 7h e ainda não avisou hoje). */
  quando: Date | null
  titulo: string
  corpo: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const chaveDoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const horaMinuto = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Os avisos a agendar: um por dia (de hoje em diante) com atendimento pendente agendado. */
export function planejarAvisos(agenda: AgendaItem[], agora: Date, jaAvisouHoje: boolean): AvisoDoDia[] {
  const hoje = chaveDoDia(agora)
  const porDia = new Map<string, AgendaItem[]>()
  for (const a of agenda) {
    if (a.status !== 'Pendente' || !a.dataAgendada) continue
    const dia = chaveDoDia(new Date(a.dataAgendada))
    if (dia < hoje) continue
    const lista = porDia.get(dia)
    if (lista) lista.push(a)
    else porDia.set(dia, [a])
  }

  const avisos: AvisoDoDia[] = []
  for (const [dia, itens] of [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    itens.sort((a, b) => a.dataAgendada!.localeCompare(b.dataAgendada!))
    const [y, m, d] = dia.split('-').map(Number)
    const asSete = new Date(y!, m! - 1, d!, HORA_DO_AVISO, 0, 0, 0)
    let quando: Date | null = asSete
    if (dia === hoje && asSete <= agora) {
      if (jaAvisouHoje) continue
      quando = null
    }
    const linhas = itens
      .slice(0, MAX_LINHAS)
      .map((a) => `${horaMinuto(new Date(a.dataAgendada!))} · ${a.clienteNome}${a.resumo ? ` — ${a.resumo}` : ''}`)
    if (itens.length > MAX_LINHAS) linhas.push(`e mais ${itens.length - MAX_LINHAS}`)
    const n = itens.length
    avisos.push({
      dia,
      quando,
      titulo: `Hoje: ${n} atendimento${n === 1 ? '' : 's'} pendente${n === 1 ? '' : 's'}`,
      corpo: linhas.join('\n'),
    })
  }
  return avisos
}

async function permitido(N: Notificacoes): Promise<boolean> {
  const atual = await N.getPermissionsAsync()
  if (atual.granted) return true
  if (!atual.canAskAgain) return false
  return (await N.requestPermissionsAsync()).granted
}

async function cancelarDoAgesto(N: Notificacoes): Promise<void> {
  const agendadas = await N.getAllScheduledNotificationsAsync()
  for (const n of agendadas) {
    if (n.identifier.startsWith(PREFIXO_AVISO)) await N.cancelScheduledNotificationAsync(n.identifier)
  }
}

/** Troca os avisos agendados pelos da agenda local atual. Chamada depois de cada sincronização. */
export async function agendarAvisosDoDia(database: LocalDb, agora = new Date()): Promise<void> {
  const N = notificacoes()
  if (!N) return
  try {
    if (!(await permitido(N))) return
    await N.setNotificationChannelAsync(CANAL, {
      name: 'Agenda do dia',
      importance: N.AndroidImportance.HIGH,
    })
    await cancelarDoAgesto(N)

    const hoje = chaveDoDia(agora)
    const jaAvisouHoje = (await database.getMeta(META_AVISADO)) === hoje
    const avisos = planejarAvisos(await database.getAgenda(), agora, jaAvisouHoje)
    for (const a of avisos) {
      await N.scheduleNotificationAsync({
        identifier: `${PREFIXO_AVISO}${a.dia}`,
        content: { title: a.titulo, body: a.corpo, data: { dia: a.dia } },
        trigger: a.quando
          ? { type: N.SchedulableTriggerInputTypes.DATE, date: a.quando, channelId: CANAL }
          : { channelId: CANAL },
      })
      // Hoje já tem aviso (agora ou às 7h): as próximas sincronizações do dia não repetem.
      if (a.dia === hoje) await database.setMeta(META_AVISADO, hoje)
    }
  } catch {
    // sem aviso desta vez; a próxima sincronização tenta de novo
  }
}

/** Sair da conta: os avisos eram do usuário que saiu. */
export async function cancelarAvisosDoDia(): Promise<void> {
  const N = notificacoes()
  if (!N) return
  try {
    await cancelarDoAgesto(N)
  } catch {
    // nada a fazer
  }
}
