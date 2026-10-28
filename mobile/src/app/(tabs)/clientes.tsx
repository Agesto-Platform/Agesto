import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { cpfValido } from '@/features/clientes/validateCliente'

interface Row {
  key: string
  nome: string
  sub: string
  /** uuid do cliente ainda não enviado (toque para corrigir); null quando já está no servidor. */
  pendente: string | null
  cpfInvalido: boolean
}

export default function Clientes() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        const [ref, pend] = await Promise.all([db.getClientes(), db.getPendingClientes()])
        if (!active) return
        setRows([
          ...pend.filter((c) => c.syncedAt === null).map((c) => ({
            key: `p${c.uuid}`, nome: c.nome, sub: c.telefone ?? c.cpf, pendente: c.uuid, cpfInvalido: !cpfValido(c.cpf),
          })),
          ...ref.map((c) => ({ key: `r${c.id}`, nome: c.nome, sub: c.telefone ?? c.cidade ?? c.cpf, pendente: null, cpfInvalido: false })),
        ])
      })()
      return () => {
        active = false
      }
    }, []),
  )

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <Pressable onPress={() => router.push('/cliente-novo')} style={({ pressed }) => [styles.novo, pressed && { opacity: 0.9 }]}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.novoText}>Novo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {rows.map((r) => (
          // Ainda não enviado: toque para corrigir (ex.: CPF que o servidor recusou).
          <Pressable
            key={r.key}
            onPress={r.pendente ? () => router.push(`/cliente-novo?editar=${r.pendente}`) : undefined}
            disabled={!r.pendente}
            accessibilityRole={r.pendente ? 'button' : undefined}
            accessibilityLabel={r.pendente ? `Corrigir cliente ${r.nome}` : undefined}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{r.nome.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{r.nome}</Text>
              <Text style={styles.rowSub}>{r.sub}</Text>
            </View>
            {r.cpfInvalido ? (
              <View style={[styles.badge, styles.badgeBad]}>
                <Text style={[styles.badgeText, styles.badgeBadText]}>CPF inválido</Text>
              </View>
            ) : (
              r.pendente && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>não enviado</Text>
                </View>
              )
            )}
          </Pressable>
        ))}
        {rows.length === 0 && <Text style={styles.empty}>Nenhum cliente ainda.</Text>}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  novo: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2) },
  novoText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },

  body: { padding: space(4), gap: space(2.5) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: space(3.5),
  },
  avatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brandInk, fontWeight: '700', fontSize: 15 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  badge: { backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: space(2.25), paddingVertical: space(1) },
  badgeText: { color: colors.warn, fontSize: 11, fontWeight: '700' },
  badgeBad: { backgroundColor: colors.surface2 },
  badgeBadText: { color: colors.bad },
  empty: { fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: space(6) },
})
