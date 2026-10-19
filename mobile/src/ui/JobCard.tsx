import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, space } from './theme'
import { urlNavegacao } from '@/features/rota/montarRota'
import type { AgendaItem } from '@/types/api'

function hora(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Linha grande de agenda. `highlight` = próximo atendimento. O botão da direita
 * abre a navegação até o cliente quando há endereço completo.
 */
export function JobCard({ item, highlight = false }: { item: AgendaItem; highlight?: boolean }) {
  return (
    <View style={[styles.job, highlight && styles.next]}>
      <View style={styles.time}>
        <Text style={styles.timeH}>{hora(item.dataAgendada)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.resumo}
        </Text>
        <Text style={styles.client}>{item.clienteNome}</Text>
        {item.enderecoResumo && (
          <View style={styles.addrRow}>
            <Ionicons name="location-outline" size={13} color={colors.ink4} />
            <Text style={styles.addr} numberOfLines={1}>
              {item.enderecoResumo}
            </Text>
          </View>
        )}
        {highlight && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Iniciar agora</Text>
          </View>
        )}
      </View>
      {item.enderecoCompleto ? (
        <Pressable
          onPress={() => Linking.openURL(urlNavegacao(item.enderecoCompleto!))}
          accessibilityRole="button"
          accessibilityLabel={`Ir até ${item.clienteNome}`}
          style={({ pressed }) => [styles.go, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="navigate" size={18} color={colors.brandInk} />
        </Pressable>
      ) : (
        <View style={styles.go}>
          <Ionicons name="chevron-forward" size={19} color={colors.brandInk} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  job: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: space(3.75),
  },
  next: { borderColor: colors.good, backgroundColor: colors.goodSoft },
  time: { width: 52, alignItems: 'center' },
  timeH: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { flex: 1, gap: space(1) },
  title: { fontSize: 16, fontWeight: '600', color: colors.ink },
  client: { fontSize: 14, color: colors.ink2 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  addr: { flex: 1, fontSize: 13, color: colors.ink3 },
  badge: { marginTop: space(1), backgroundColor: colors.good, borderRadius: radius.pill, paddingHorizontal: space(2.25), paddingVertical: space(1), alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  go: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
})
