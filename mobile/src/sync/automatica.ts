import { useEffect, useRef } from 'react'
import { db } from '@/db/instance'
import type { LocalDb } from '@/db/types'
import { sincronizar, type SincronizacaoResult } from './sync'

/** Sem nada pendente, a sincronização automática espera este intervalo entre uma e outra. */
export const INTERVALO_MINIMO_MS = 5 * 60 * 1000

/**
 * Telas em que o agente pode estar mexendo num registro pendente: enviar no
 * meio da correção mandaria a versão antiga e a correção se perderia.
 */
const TELAS_DE_EDICAO = new Set(['registrar', 'cliente-novo'])

let emAndamento: Promise<SincronizacaoResult> | null = null
let ultimaEm = 0
const ouvintes = new Set<() => void>()

/**
 * Uma sincronização por vez: se já há uma rodando (automática ou do botão),
 * devolve a mesma em vez de enviar o pendente de novo. Ao dar certo, avisa as
 * telas para recarregarem.
 */
export function sincronizarUmaVez(database: LocalDb = db): Promise<SincronizacaoResult> {
  if (!emAndamento) {
    emAndamento = sincronizar(database)
      .then((r) => {
        ultimaEm = Date.now()
        for (const f of ouvintes) f()
        return r
      })
      .finally(() => {
        emAndamento = null
      })
  }
  return emAndamento
}

/**
 * Regra da sincronização automática (I5): com algo pendente, envia já; sem
 * nada pendente, só baixa o que mudou se a última foi há mais de 5 minutos.
 * Nunca no meio de um cadastro ou correção.
 */
export function deveSincronizar({
  pendentes,
  msDesdeUltima,
  tela,
}: {
  pendentes: number
  msDesdeUltima: number
  tela: string | undefined
}): boolean {
  if (tela && TELAS_DE_EDICAO.has(tela)) return false
  // Muito "no futuro" = relógio do aparelho atrasado em relação ao servidor; trata como antiga.
  return pendentes > 0 || msDesdeUltima >= INTERVALO_MINIMO_MS || msDesdeUltima < -INTERVALO_MINIMO_MS
}

/** Quando foi a última sincronização: a desta sessão ou a gravada no aparelho. */
export function ultimaSincronizacao(lastSync: string | null): number {
  return Math.max(ultimaEm, lastSync ? Date.parse(lastSync) || 0 : 0)
}

/**
 * Chama `recarregar` depois de cada sincronização que deu certo, inclusive a
 * automática que termina com a tela já aberta.
 */
export function useAoSincronizar(recarregar: () => void) {
  const atual = useRef(recarregar)
  useEffect(() => {
    atual.current = recarregar
  }, [recarregar])
  useEffect(() => {
    const ouvinte = () => atual.current()
    ouvintes.add(ouvinte)
    return () => {
      ouvintes.delete(ouvinte)
    }
  }, [])
}
