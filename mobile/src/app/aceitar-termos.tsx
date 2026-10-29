import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { useAuth } from '@/auth/useAuth'
import { ApiError } from '@/lib/errors'

/** Aceite dos termos de uso e da política de privacidade (B6), antes de usar o app. */
export default function AceitarTermos() {
  const { termos, aceitarTermos, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onAceitar() {
    setError(null)
    setBusy(true)
    try {
      // A guarda de rota segue para a próxima etapa quando a pendência some.
      await aceitarTermos()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível registrar o aceite. Verifique a conexão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Termos de uso e privacidade</Text>
        <Text style={styles.sub}>
          Para usar o Agesto, leia os termos de uso e a política de privacidade. Eles dizem como o app funciona e como
          tratamos os seus dados e os dos clientes.
        </Text>

        <Documento titulo="Termos de uso" url={termos?.urlTermos ?? null} />
        <Documento titulo="Política de privacidade" url={termos?.urlPrivacidade ?? null} />
        {termos && <Text style={styles.versao}>Versão {termos.versao}</Text>}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={onAceitar}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Li e aceito</Text>}
        </Pressable>

        <Pressable onPress={logout} disabled={busy} style={styles.sair}>
          <Text style={styles.sairText}>Sair</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

function Documento({ titulo, url }: { titulo: string; url: string | null }) {
  return (
    <Pressable
      onPress={url ? () => Linking.openURL(url) : undefined}
      disabled={!url}
      accessibilityRole={url ? 'link' : undefined}
      style={({ pressed }) => [styles.doc, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name="document-text-outline" size={20} color={colors.brandInk} />
      <Text style={styles.docText}>{titulo}</Text>
      {url && <Ionicons name="open-outline" size={16} color={colors.ink3} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space(6), gap: space(4), justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13.5, color: colors.ink3, marginTop: -space(2) },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space(3.5),
  },
  docText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  versao: { fontSize: 12, color: colors.ink4, marginTop: -space(2) },
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
