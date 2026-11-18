import type { LocalDb } from '@/db/types'
import { decodeJwt } from '@/lib/jwt'

// Dono dos dados locais (gravado em meta no login).
const META_SUB = 'ownerSub'
const META_EMPRESA = 'ownerEmpresaId'
// Email de quem criou os dados, só para a mensagem de aviso no login.
const META_EMAIL = 'ownerEmail'

/** Registros criados no device que ainda não subiram (atendimentos, clientes e serviços). */
export async function countPendentes(db: LocalDb): Promise<number> {
  const [at, cli, serv] = await Promise.all([
    db.getPendingAtendimentos(),
    db.getPendingClientes(),
    db.getPendingServicos(),
  ])
  return at.length + cli.filter((c) => c.syncedAt === null).length + serv.filter((s) => s.syncedAt === null).length
}

/**
 * Outra conta tenta entrar num aparelho com registros não enviados de quem usou antes
 * (MOB-01). Os dados não são apagados: a tela de login pergunta antes.
 */
export class PendenciasDeOutraContaError extends Error {
  constructor(
    readonly pendentes: number,
    readonly emailAnterior: string | null,
  ) {
    super(
      `Este aparelho tem ${pendentes} registro(s) não enviado(s)` +
        (emailAnterior ? ` de ${emailAnterior}` : ' de outra conta') +
        '. Para enviá-los, entre com essa conta. Se continuar, eles serão apagados deste aparelho.',
    )
    this.name = 'PendenciasDeOutraContaError'
  }
}

/**
 * Garante que o banco local é do usuário que acabou de logar. Se já houver outro
 * sub/empresaId gravado (ou o token não tiver esses claims), apaga tudo antes de seguir,
 * mas só depois de confirmar quando há pendências: sem `descartarPendencias`, lança
 * PendenciasDeOutraContaError e não mexe em nada. Devolve true se resetou.
 */
export async function ensureLocalOwner(
  db: LocalDb,
  token: string,
  { email, descartarPendencias = false }: { email?: string; descartarPendencias?: boolean } = {},
): Promise<boolean> {
  const claims = decodeJwt(token)
  const sub = claims?.sub
  const empresaId = claims?.empresaId

  const [prevSub, prevEmpresa] = await Promise.all([db.getMeta(META_SUB), db.getMeta(META_EMPRESA)])
  const outroDono =
    !sub ||
    !empresaId ||
    (prevSub !== null && prevSub !== sub) ||
    (prevEmpresa !== null && prevEmpresa !== empresaId)

  if (outroDono) {
    const pendentes = await countPendentes(db)
    if (pendentes > 0 && !descartarPendencias) {
      throw new PendenciasDeOutraContaError(pendentes, await db.getMeta(META_EMAIL))
    }
    await db.reset()
  }

  if (sub && empresaId) {
    await db.setMeta(META_SUB, sub)
    await db.setMeta(META_EMPRESA, empresaId)
  }
  if (email) await db.setMeta(META_EMAIL, email)
  return outroDono
}
