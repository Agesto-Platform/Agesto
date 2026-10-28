import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { JobCard } from '@/ui/JobCard'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { getConfig } from '@/lib/appConfig'
import { acaoDaAgenda } from '@/features/agenda/acaoDaAgenda'
import { useAoSincronizar } from '@/sync/automatica'
import type { LocalAtendimento } from '@/db/types'
import type { AgendaItem } from '@/types/api'

interface DayGroup {
  key: string
  label: string
  items: AgendaItem[]
}

const SEM_DATA = 'sem-data'

/** Rótulo do dia: "Hoje" / "Amanhã" / "Seg, 18 ago" a partir do ISO. */
function labelDoDia(iso: string): string {
  if (iso === SEM_DATA) return 'Sem horário definido'
  const d = new Date(`${iso}T00:00:00`)
  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diff = Math.round((d.getTime() - base.getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  const s = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Chave de dia (yyyy-mm-dd) a partir do dataAgendada; null → SEM_DATA. */
function chaveDoDia(iso: string | null): string {
  if (!iso) return SEM_DATA
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function agrupar(items: AgendaItem[]): DayGroup[] {
  const mapa = new Map<string, AgendaItem[]>()
  for (const item of items) {
    const k = chaveDoDia(item.dataAgendada)
    const arr = mapa.get(k)
    if (arr) arr.push(item)
    else mapa.set(k, [item])
  }
  const chaves = [...mapa.keys()].sort((a, b) => {
    if (a === SEM_DATA) return 1
    if (b === SEM_DATA) return -1
    return a.localeCompare(b)
  })
  return chaves.map((k) => ({
    key: k,
    label: labelDoDia(k),
    items: (mapa.get(k) ?? []).sort((a, b) =>
      String(a.dataAgendada).localeCompare(String(b.dataAgendada)),
    ),
  }))
}

export default function Agenda() {
  const router = useRouter()
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [podeAgendar, setPodeAgendar] = useState(false)
  const [pendentes, setPendentes] = useState<LocalAtendimento[]>([])

  const carregar = useCallback(async (ativo: () => boolean = () => true) => {
    const [items, config, pend] = await Promise.all([db.getAgenda(), getConfig(db), db.getPendingAtendimentos()])
    if (!ativo()) return
    setPendentes(pend)
    setGroups(agrupar(items))
    setPodeAgendar(config.modoAgendaAgente === 'Flexivel')
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

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Agenda</Text>
          <Text style={styles.count}>{total} agendado{total === 1 ? '' : 's'}</Text>
        </View>
        {podeAgendar && (
          <Pressable
            onPress={() => router.push('/registrar?modo=agendar')}
            style={({ pressed }) => [styles.novo, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.novoText}>Agendar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {groups.map((g) => (
          <View key={g.key} style={styles.group}>
            <Text style={styles.dayLabel}>{g.label}</Text>
            <View style={{ gap: space(2.75) }}>
              {g.items.map((item) => {
                const { rota: destino, etiqueta } = acaoDaAgenda(item, pendentes)
                return (
                  <JobCard
                    key={item.id}
                    item={item}
                    etiqueta={etiqueta}
                    onPress={destino ? () => router.push(destino) : undefined}
                  />
                )
              })}
            </View>
          </View>
        ))}
        {total === 0 && <Text style={styles.empty}>Nenhum atendimento agendado.</Text>}
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
  count: { fontSize: 13, color: colors.ink3, marginTop: 2 },
  novo: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2) },
  novoText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },

  body: { padding: space(4), gap: space(4) },
  group: { gap: space(2.5) },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.ink4,
    paddingHorizontal: space(1),
  },
  empty: { fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: space(6) },
})
