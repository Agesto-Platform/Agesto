import type { LocalDb } from '@/db/types'
import { decodeJwt } from '@/lib/jwt'

// Dono dos dados locais (gravado em meta no login).
const META_SUB = 'ownerSub'
const META_EMPRESA = 'ownerEmpresaId'

/** Registros criados no device que ainda não subiram (atendimentos + clientes). */
export async function countPendentes(db: LocalDb): Promise<number> {
  const [at, cli] = await Promise.all([db.getPendingAtendimentos(), db.getPendingClientes()])
  return at.length + cli.filter((c) => c.syncedAt === null).length
}

/**
 * Garante que o banco local é do usuário que acabou de logar: se já houver
 * outro sub/empresaId gravado (ou o token não tiver esses claims), apaga tudo
 * antes de seguir. Devolve true se resetou.
 */
export async function ensureLocalOwner(db: LocalDb, token: string): Promise<boolean> {
  const claims = decodeJwt(token)
  const sub = claims?.sub
  const empresaId = claims?.empresaId
  if (!sub || !empresaId) {
    await db.reset()
    return true
  }

  const [prevSub, prevEmpresa] = await Promise.all([db.getMeta(META_SUB), db.getMeta(META_EMPRESA)])
  const outroDono =
    (prevSub !== null && prevSub !== sub) || (prevEmpresa !== null && prevEmpresa !== empresaId)
  if (outroDono) await db.reset()

  await db.setMeta(META_SUB, sub)
  await db.setMeta(META_EMPRESA, empresaId)
  return outroDono
}
