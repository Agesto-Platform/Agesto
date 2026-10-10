import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { useAuth } from '@/auth/useAuth'
import { countPendentes } from '@/auth/localData'
import { db } from '@/db/instance'
import { descarga, initialSync } from '@/sync/sync'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Mais() {
  const { logout } = useAuth()
  const [pendAt, setPendAt] = useState(0)
  const [pendCli, setPendCli] = useState(0)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [at, cli, ls] = await Promise.all([
      db.getPendingAtendimentos(),
      db.getPendingClientes(),
      db.getMeta('lastSync'),
    ])
    setPendAt(at.length)
    setPendCli(cli.filter((c) => c.syncedAt === null).length)
    setLastSync(ls)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        if (active) await reload()
      })()
      return () => {
        active = false
      }
    }, [reload]),
  )

  async function sincronizar() {
    setSyncing(true)
    setFlash(null)
    try {
      const r = await descarga()
      // Atualiza a referência: clientes recém-enviados passam a vir da Carga.
      await initialSync()
      const enviados = `Enviados: ${r.atendimentosImportados} atendimento(s), ${r.clientesImportados} cliente(s).`
      setFlash(
        r.erros.length > 0
          ? `${enviados} ${r.erros.length} não enviado(s), seguem pendentes: ${r.erros[0]}`
          : enviados,
      )
      await reload()
    } catch {
      setFlash('Falha ao sincronizar. Tente novamente com internet.')
    } finally {
      setSyncing(false)
    }
  }

  // Sair apaga o banco local: se há pendências, confirma antes de perdê-las.
  async function sair() {
    const n = await countPendentes(db)
    if (n === 0) {
      await logout()
      return
    }
    const msg = `Há ${n} registro(s) não sincronizado(s). Sair vai apagá-los deste aparelho.`
    // No web o Alert do RN não tem botões: usa o confirm do navegador.
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) await logout()
      return
    }
    Alert.alert('Sair', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair mesmo assim', style: 'destructive', onPress: () => void logout() },
    ])
  }

  const pendentes = pendAt + pendCli

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Mais</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="sync-outline" size={18} color={colors.brandInk} />
            <Text style={styles.cardTitle}>Sincronização</Text>
          </View>
          <Text style={styles.status}>
            {pendentes === 0
              ? 'Tudo sincronizado.'
              : `${pendAt} atendimento${pendAt === 1 ? '' : 's'} e ${pendCli} cliente${pendCli === 1 ? '' : 's'} pendentes de envio.`}
          </Text>
          <Text style={styles.sub}>Última sincronização: {fmt(lastSync)}</Text>
          {flash && <Text style={styles.flash}>{flash}</Text>}
          <Pressable
            onPress={sincronizar}
            disabled={syncing || pendentes === 0}
            style={({ pressed }) => [styles.syncBtn, (syncing || pendentes === 0 || pressed) && { opacity: 0.6 }]}
          >
            {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>Sincronizar agora</Text>}
          </Pressable>
        </View>

        <Pressable onPress={sair} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          <Ionicons name="log-out-outline" size={20} color={colors.bad} />
          <Text style={styles.rowText}>Sair</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space(5), gap: space(4) },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: space(4), gap: space(2) },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  status: { fontSize: 14, color: colors.ink2 },
  sub: { fontSize: 12.5, color: colors.ink3 },
  flash: { fontSize: 12.5, color: colors.good, fontWeight: '600' },
  syncBtn: { marginTop: space(2), backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: space(3.25), alignItems: 'center' },
  syncText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: space(4),
  },
  rowText: { fontSize: 15, fontWeight: '600', color: colors.bad },
})
