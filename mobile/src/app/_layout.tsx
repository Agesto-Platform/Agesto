import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { notificacoes, PREFIXO_AVISO } from '@/lib/avisosDoDia'

// Segura a splash até a Geist carregar, para a tela não piscar com a fonte do sistema.
SplashScreen.preventAutoHideAsync().catch(() => {})

function Guard() {
  const { token, ready, deveTrocarSenha, termos } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    const onLogin = segments[0] === 'login'
    const onTroca = segments[0] === 'trocar-senha'
    const onTermos = segments[0] === 'aceitar-termos'
    // "Esqueci a senha" é pública como o login: abre sem token.
    const onEsqueci = segments[0] === 'esqueci-senha'
    const pendente = termos !== null || deveTrocarSenha
    if (!token && !onLogin && !onEsqueci) router.replace('/login')
    // Termos primeiro (B6): nada do app antes do aceite.
    else if (token && termos && !onTermos) router.replace('/aceitar-termos')
    // Senha provisória: só sai da troca depois de concluir.
    else if (token && !termos && deveTrocarSenha && !onTroca) router.replace('/trocar-senha')
    else if (token && !pendente && (onLogin || onTroca || onTermos || onEsqueci)) router.replace('/')
  }, [token, ready, deveTrocarSenha, termos, segments, router])

  // Tocar no aviso do dia abre a Agenda.
  useEffect(() => {
    const N = notificacoes()
    if (!N) return
    const sub = N.addNotificationResponseReceivedListener((r) => {
      if (r.notification.request.identifier.startsWith(PREFIXO_AVISO)) router.push('/agenda')
    })
    return () => sub.remove()
  }, [router])

  return <Stack screenOptions={{ headerShown: false }} />
}

// Com o app aberto, o aviso do dia também aparece (sem som: é um lembrete).
notificacoes()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export default function RootLayout() {
  const [fontesProntas, erroFontes] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold })
  const pronto = fontesProntas || erroFontes !== null

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {})
  }, [pronto])

  // Se a fonte falhar, segue com a do sistema em vez de travar na splash.
  if (!pronto) return null

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
