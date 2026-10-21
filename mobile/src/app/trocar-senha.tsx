import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { useAuth } from '@/auth/useAuth'
import { ApiError } from '@/lib/errors'
import { validarNovaSenha } from '@/features/conta/validarNovaSenha'

/** Primeiro acesso com senha provisória: o agente cria a própria senha. */
export default function TrocarSenha() {
  const { trocarSenha, logout } = useAuth()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    const problema = validarNovaSenha(atual, nova, confirma)
    if (problema) return setError(problema)
    setError(null)
    setBusy(true)
    try {
      // A guarda de rota leva para o início quando a pendência some.
      await trocarSenha(atual, nova)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível trocar a senha. Verifique a conexão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Crie sua senha</Text>
        <Text style={styles.sub}>
          Você entrou com a senha provisória que recebeu. Defina uma senha só sua para continuar.
        </Text>

        <Campo label="Senha provisória" value={atual} onChange={setAtual} />
        <Campo label="Nova senha" value={nova} onChange={setNova} />
        <Campo label="Confirme a nova senha" value={confirma} onChange={setConfirma} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar nova senha</Text>}
        </Pressable>

        <Pressable onPress={logout} disabled={busy} style={styles.sair}>
          <Text style={styles.sairText}>Sair</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry
        autoCapitalize="none"
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space(6), gap: space(4), justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13.5, color: colors.ink3, marginTop: -space(2) },
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
  sair: { alignItems: 'center', paddingVertical: space(2) },
  sairText: { color: colors.ink3, fontWeight: '600', fontSize: 13.5 },
})
