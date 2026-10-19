import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'

function Guard() {
  const { token, ready, deveTrocarSenha } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    const onLogin = segments[0] === 'login'
    const onTroca = segments[0] === 'trocar-senha'
    if (!token && !onLogin) router.replace('/login')
    // Senha provisória: só sai da troca depois de concluir.
    else if (token && deveTrocarSenha && !onTroca) router.replace('/trocar-senha')
    else if (token && !deveTrocarSenha && (onLogin || onTroca)) router.replace('/')
  }, [token, ready, deveTrocarSenha, segments, router])

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
