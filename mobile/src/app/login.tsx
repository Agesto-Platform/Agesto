import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { useAuth } from '@/auth/useAuth'
import { ApiError } from '@/lib/errors'
import { DEMO_EMAIL, DEMO_SENHA } from '@/mocks/handlers'
import { config } from '@/lib/config'

export default function Login() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    setError(null)
    setBusy(true)
    try {
      // login() já roda a Carga; a guarda de rota navega ao autenticar.
      await login(email.trim(), senha)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Text style={styles.markText}>A</Text>
          </View>
          <View>
            <Text style={styles.brand}>Agesto</Text>
            <Text style={styles.brandSub}>Agente de campo</Text>
          </View>
        </View>

        <Text style={styles.title}>Entrar</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@empresa.com"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/esqueci-senha', params: { email: email.trim() } })}
          disabled={busy}
          style={styles.esqueci}
        >
          <Text style={styles.esqueciText}>Esqueci a senha</Text>
        </Pressable>

        {config.useMocks && (
          <Text style={styles.demo}>
            Demo: {DEMO_EMAIL} / {DEMO_SENHA}
          </Text>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space(6), gap: space(4), justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(2) },
  mark: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink },
  brandSub: { fontSize: 12.5, color: colors.ink4 },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
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
  esqueci: { alignItems: 'center', paddingVertical: space(2) },
  esqueciText: { color: colors.brandInk, fontWeight: '600', fontSize: 13.5 },
  demo: { textAlign: 'center', fontSize: 12, color: colors.ink4 },
})
