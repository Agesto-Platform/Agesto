import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useSegments } from 'expo-router'
import { db } from '@/db/instance'
import { countPendentes } from '@/auth/localData'
import { useAuth } from '@/auth/useAuth'
import { deveSincronizar, sincronizarUmaVez, ultimaSincronizacao } from './automatica'

/**
 * Sincroniza sozinho ao abrir o app, ao voltar para ele e quando a internet
 * volta (I5), para o atendimento não ficar esquecido sem enviar. Falhas são
 * silenciosas: o botão Sincronizar e o puxar para atualizar continuam lá.
 */
export function useSincronizacaoAutomatica() {
  const { token, deveTrocarSenha } = useAuth()
  const segments = useSegments()
  // Tela aberta no momento do gatilho, sem refazer os ouvintes a cada navegação.
  const tela = useRef<string | undefined>(segments[0])
  useEffect(() => {
    tela.current = segments[0]
  }, [segments])

  useEffect(() => {
    if (!token || deveTrocarSenha) return

    async function tentar() {
      try {
        const [pendentes, lastSync] = await Promise.all([countPendentes(db), db.getMeta('lastSync')])
        const msDesdeUltima = Date.now() - ultimaSincronizacao(lastSync)
        if (!deveSincronizar({ pendentes, msDesdeUltima, tela: tela.current })) return
        await sincronizarUmaVez()
      } catch {
        // Sem internet ou API fora do ar: tenta de novo no próximo gatilho.
      }
    }

    void tentar()
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void tentar()
    })
    let online: boolean | null = null
    const rede = NetInfo.addEventListener((estado) => {
      const agora = estado.isConnected === true && estado.isInternetReachable !== false
      if (online === false && agora) void tentar()
      online = agora
    })
    return () => {
      app.remove()
      rede()
    }
  }, [token, deveTrocarSenha])
}
