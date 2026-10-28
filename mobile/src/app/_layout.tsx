import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'

function Guard() {
  const { token, ready, deveTrocarSenha, termos } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    const onLogin = segments[0] === 'login'
    const onTroca = segments[0] === 'trocar-senha'
    const onTermos = segments[0] === 'aceitar-termos'
    const pendente = termos !== null || deveTrocarSenha
    if (!token && !onLogin) router.replace('/login')
    // Termos primeiro (B6): nada do app antes do aceite.
    else if (token && termos && !onTermos) router.replace('/aceitar-termos')
    // Senha provisória: só sai da troca depois de concluir.
    else if (token && !termos && deveTrocarSenha && !onTroca) router.replace('/trocar-senha')
    else if (token && !pendente && (onLogin || onTroca || onTermos)) router.replace('/')
  }, [token, ready, deveTrocarSenha, termos, segments, router])

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <Guard />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
