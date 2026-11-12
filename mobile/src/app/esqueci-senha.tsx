import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { emailValido } from '@/features/conta/emailValido'

const SEM_INTERNET = 'Sem conexão com a internet. Para receber o link, conecte o celular e tente de novo.'

/**
 * "Esqueci a senha" (DEC-54): pede o link por email. A senha nova é criada na
 * página web do link; depois o agente volta e entra normalmente aqui.
 */
export default function EsqueciSenha() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [enviado, setEnviado] = useState(false)

  function voltarAoLogin() {
    if (router.canGoBack()) router.back()
    else router.replace('/login')
  }

  async function onSubmit() {
    const alvo = email.trim()
    if (!emailValido(alvo)) return setError('Informe um email válido.')
    setError(null)
    setBusy(true)
    try {
      // Pedir o link precisa de internet: avisa logo, sem esperar o timeout.
      const rede = await NetInfo.fetch().catch(() => null)
      if (rede?.isConnected === false) return setError(SEM_INTERNET)
      // A resposta é a mesma exista o email ou não (não revela quem tem conta).
      await api.post<null>('/api/auth/esqueci-senha', { email: alvo })
      setEnviado(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : SEM_INTERNET)
    } finally {
      setBusy(false)
    }
  }

  if (enviado) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <Text style={styles.title}>Confira seu email</Text>
          <Text style={styles.sub}>
            Se este e-mail tiver acesso ao Agesto, enviamos um link para criar uma senha nova. O link vale por 15
            minutos. Abra o e-mail neste celular, crie a senha e volte aqui para entrar.
          </Text>
          <Pressable
            onPress={voltarAoLogin}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buttonText}>Voltar para entrar</Text>
          </Pressable>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Esqueci a senha</Text>
        <Text style={styles.sub}>
          Informe o email que você usa para entrar. Vamos enviar um link para você criar uma senha nova.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="voce@empresa.com"
            placeholderTextColor={colors.ink4}
            accessibilityLabel="Email"
            style={styles.input}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar link</Text>}
        </Pressable>

        <Pressable onPress={voltarAoLogin} disabled={busy} style={styles.voltar}>
          <Text style={styles.voltarText}>Voltar para entrar</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space(6), gap: space(4), justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13.5, lineHeight: 19, color: colors.ink3, marginTop: -space(2) },
  field: { gap: space(1.5) },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    fontSize: 15,
    color: colors.ink,
  },
  error: { color: colors.bad, fontSize: 13, fontWeight: '500' },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: space(3.5),
    alignItems: 'center',
    marginTop: space(1),
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  voltar: { alignItems: 'center', paddingVertical: space(2) },
  voltarText: { color: colors.ink3, fontWeight: '600', fontSize: 13.5 },
})
