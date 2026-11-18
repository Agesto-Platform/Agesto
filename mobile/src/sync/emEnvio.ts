import type { LocalDb } from '@/db/types'

/**
 * Trava de edição durante o envio (MOB-03). Enquanto a Descarga está no ar, ou se o
 * último envio ficou sem resposta (rede caiu, erro 5xx), o servidor pode já ter gravado
 * a versão enviada; uma correção feita agora seria marcada como enviada sem nunca chegar
 * lá. Então o registro fica travado até uma Descarga com resposta confirmar o destino dele.
 */
const META_INCERTOS = 'envioSemResposta'

/** uuids na Descarga em andamento (só desta execução do app). */
const emAndamento = new Set<string>()

export const MENSAGEM_EM_ENVIO =
  'Este registro está sendo enviado, ou o último envio ficou sem resposta. Sincronize de novo antes de alterar, para a correção não se perder.'

export const MENSAGEM_JA_ENVIADO =
  'Este registro foi enviado enquanto você editava, e a alteração não foi salva. Se precisar corrigir, peça ao responsável pelo painel.'

const chave = (uuid: string) => uuid.toLowerCase()

async function lerIncertos(db: LocalDb): Promise<Set<string>> {
  try {
    const lista = JSON.parse((await db.getMeta(META_INCERTOS)) ?? '[]') as unknown
    return new Set(Array.isArray(lista) ? lista.filter((u): u is string => typeof u === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Antes do POST: trava os uuids e grava no aparelho (sobrevive se o app fechar no meio). */
export async function iniciarEnvio(db: LocalDb, uuids: string[]): Promise<void> {
  const incertos = await lerIncertos(db)
  for (const u of uuids) {
    emAndamento.add(chave(u))
    incertos.add(chave(u))
  }
  await db.setMeta(META_INCERTOS, JSON.stringify([...incertos]))
}

/**
 * Depois do POST. `respondeu` = o servidor deu uma resposta que diz o que aconteceu
 * (sucesso ou recusa 4xx antes de gravar): libera. Sem resposta ou 5xx: segue travado.
 */
export async function terminarEnvio(db: LocalDb, uuids: string[], respondeu: boolean): Promise<void> {
  for (const u of uuids) emAndamento.delete(chave(u))
  if (!respondeu) return
  const incertos = await lerIncertos(db)
  for (const u of uuids) incertos.delete(chave(u))
  await db.setMeta(META_INCERTOS, JSON.stringify([...incertos]))
}

/** false enquanto o registro está no ar ou com envio sem resposta. */
export async function podeAlterar(db: LocalDb, uuid: string | null | undefined): Promise<boolean> {
  if (!uuid) return true
  if (emAndamento.has(chave(uuid))) return false
  return !(await lerIncertos(db)).has(chave(uuid))
}
