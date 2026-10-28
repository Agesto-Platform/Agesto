import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { useAoSincronizar } from '@/sync/automatica'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { getRecusas, motivoDaRecusa } from '@/sync/sync'
import type { StatusAtendimento } from '@/types/api'

interface Row {
  key: string
  cliente: string
  data: string
  itens: number
  status: StatusAtendimento
  pending: boolean
  /** Por que o servidor não aceitou no último envio (I2); null se não recusou. */
  motivo: string | null
}

const STATUS: Record<StatusAtendimento, { label: string; fg: string; bg: string }> = {
  Concluido: { label: 'Concluído', fg: colors.good, bg: colors.goodSoft },
  Pendente: { label: 'Pendente', fg: colors.warn, bg: colors.warnSoft },
  Cancelado: { label: 'Cancelado', fg: colors.bad, bg: colors.surface2 },
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${dia} · ${hora}`
}

export default function Atendimentos() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])

  const carregar = useCallback(async (ativo: () => boolean = () => true) => {
    const [atends, clientes, pend, recusas] = await Promise.all([
      db.getAtendimentos(),
      db.getClientes(),
      db.getPendingClientes(),
      getRecusas(db),
    ])
    if (!ativo()) return
    const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]))
    const nomePorUuid = new Map(pend.map((c) => [c.uuid, c.nome]))
    const list = [...atends]
      .sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro))
      .map((a) => ({
        key: a.uuid,
        cliente:
          (a.clienteId !== null ? nomePorId.get(a.clienteId) : undefined) ??
          (a.clienteUuid ? nomePorUuid.get(a.clienteUuid) : undefined) ??
          `Cliente #${a.clienteId ?? 'novo'}`,
        data: dataCurta(a.dataRegistro),
        itens: a.itensProduto.length + a.itensServico.length,
        status: a.status,
        pending: a.syncedAt === null,
        motivo: a.syncedAt === null ? motivoDaRecusa(a, recusas) : null,
      }))
    setRows(list)
  }, [])

  useAoSincronizar(carregar)
  useFocusEffect(
    useCallback(() => {
      let active = true
      void carregar(() => active)
      return () => {
        active = false
      }
    }, [carregar]),
  )

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Atendimentos</Text>
        <Pressable
          onPress={() => router.push('/registrar')}
          style={({ pressed }) => [styles.novo, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.novoText}>Registrar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {rows.map((r) => {
          const s = STATUS[r.status]
          // Ainda não enviado: toque para corrigir ou excluir.
          return (
            <Pressable
              key={r.key}
              onPress={r.pending ? () => router.push(`/registrar?editar=${r.key}`) : undefined}
              disabled={!r.pending}
              accessibilityRole={r.pending ? 'button' : undefined}
              accessibilityLabel={
                r.pending ? `Corrigir atendimento de ${r.cliente}${r.motivo ? `. Não aceito: ${r.motivo}` : ''}` : undefined
              }
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, gap: space(1) }}>
                <Text style={styles.rowName}>{r.cliente}</Text>
                <Text style={styles.rowSub}>
                  {r.data} · {r.itens} {r.itens === 1 ? 'item' : 'itens'}
                </Text>
                {r.motivo && (
                  <View style={styles.motivo}>
                    <Ionicons name="alert-circle" size={14} color={colors.bad} style={{ marginTop: 1 }} />
                    <Text style={styles.motivoText}>{r.motivo}</Text>
                  </View>
                )}
              </View>
              <View style={styles.tags}>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
                </View>
                {r.pending && (
                  <View style={styles.pendingPill}>
                    <Ionicons name="cloud-upload-outline" size={12} color={colors.warn} />
                    <Text style={styles.pendingText}>não enviado</Text>
                  </View>
                )}
              </View>
              {r.pending && <Ionicons name="chevron-forward" size={18} color={colors.ink4} />}
            </Pressable>
          )
        })}
        {rows.length === 0 && (
          <Text style={styles.empty}>Nenhum atendimento registrado ainda.</Text>
        )}
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
    padding: space(3.75),
  },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.ink3 },
  motivo: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), marginTop: space(0.5) },
  motivoText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: colors.bad },
  tags: { alignItems: 'flex-end', gap: space(1.5) },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  pendingPill: { flexDirection: 'row', alignItems: 'center', gap: space(1), backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.75) },
  pendingText: { color: colors.warn, fontSize: 10.5, fontWeight: '700' },

  empty: { fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: space(6) },
})
