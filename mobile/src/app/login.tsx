import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { colors, radius, space, font } from '@/ui/theme'
import { useAuth } from '@/auth/useAuth'
import { ApiError } from '@/lib/errors'
import { PendenciasDeOutraContaError } from '@/auth/localData'
import { confirmar } from '@/ui/confirmar'
import { DEMO_EMAIL, DEMO_SENHA } from '@/mocks/handlers'
import { config } from '@/lib/config'

export default function Login() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function entrar(descartarPendencias = false) {
    setError(null)
    setBusy(true)
    try {
      // login() já roda a Carga; a guarda de rota navega ao autenticar.
      await login(email.trim(), senha, { descartarPendencias })
    } catch (e) {
      if (e instanceof PendenciasDeOutraContaError) {
        // Nada foi apagado ainda: só apaga se a pessoa confirmar (MOB-01).
        confirmar('Registros não enviados', e.message, () => void entrar(true), {
          acao: 'Apagar e entrar',
          voltar: 'Cancelar',
        })
        return
      }
      setError(e instanceof ApiError ? e.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = () => void entrar()

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
  markText: { color: '#fff', fontFamily: font.semibold, fontSize: 18 },
  brand: { fontSize: 18, fontFamily: font.semibold, color: colors.ink },
  brandSub: { fontFamily: font.regular, fontSize: 12.5, color: colors.ink3 },
  title: { fontSize: 17, fontFamily: font.semibold, color: colors.ink },
  field: { gap: space(1.5) },
  label: { fontSize: 12.5, fontFamily: font.semibold, color: colors.ink2 },
  input: {
    fontFamily: font.regular,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    fontSize: 15,
    color: colors.ink,
  },
  error: { color: colors.bad, fontSize: 13, fontFamily: font.medium },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: space(3.5),
    alignItems: 'center',
    marginTop: space(1),
  },
  buttonText: { color: '#fff', fontFamily: font.semibold, fontSize: 15 },
  esqueci: { alignItems: 'center', paddingVertical: space(2) },
  esqueciText: { color: colors.brandInk, fontFamily: font.semibold, fontSize: 13.5 },
  demo: { fontFamily: font.regular, textAlign: 'center', fontSize: 12, color: colors.ink3 },
})
