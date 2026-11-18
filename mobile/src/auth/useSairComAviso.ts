import { useCallback } from 'react'
import { db } from '@/db/instance'
import { confirmar } from '@/ui/confirmar'
import { countPendentes } from './localData'
import { useAuth } from './useAuth'

/**
 * Sair apaga o banco local. Com pendências, confirma antes de perdê-las. Vale para
 * todo botão "Sair" (Mais, aceitar termos, trocar senha), não só o da aba Mais (MOB-01).
 */
export function useSairComAviso(): () => Promise<void> {
  const { logout } = useAuth()
  return useCallback(async () => {
    const n = await countPendentes(db)
    if (n === 0) {
      await logout()
      return
    }
    confirmar(
      'Sair',
      `Há ${n} registro(s) não sincronizado(s). Sair vai apagá-los deste aparelho.`,
      () => void logout(),
      { acao: 'Sair mesmo assim' },
    )
  }, [logout])
}
