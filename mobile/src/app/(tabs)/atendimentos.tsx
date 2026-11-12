import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { Screen } from '@/ui/Screen'
import { useAoSincronizar } from '@/sync/automatica'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { getRecusas, motivoDaRecusa } from '@/sync/sync'
import { brl } from '@/ui/ValorEditavel'
import { buscarHistorico, montarLista, type LinhaAtendimento } from '@/features/atendimentos/historico'
import type { AgendaItem, StatusAtendimento } from '@/types/api'

/** Histórico do servidor já carregado; null quando não deu para buscar. */
interface Historico {
  itens: AgendaItem[]
  pagina: number
  total: number
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
  const [locais, setLocais] = useState<LinhaAtendimento[]>([])
  const [historico, setHistorico] = useState<Historico | null>(null)
  const [semHistorico, setSemHistorico] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState(false)
  const rows = useMemo(() => montarLista(locais, historico?.itens ?? null), [locais, historico])
  const temMais = historico !== null && historico.itens.length < historico.total

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
    // O que está no aparelho aparece na hora; o histórico do servidor chega depois.
    setLocais(
      atends.map((a) => ({
        key: a.uuid,
        cliente:
          (a.clienteId !== null ? nomePorId.get(a.clienteId) : undefined) ??
          (a.clienteUuid ? nomePorUuid.get(a.clienteUuid) : undefined) ??
          `Cliente #${a.clienteId ?? 'novo'}`,
        data: a.dataAgendada ?? a.dataRegistro,
        itens: a.itensProduto.length + a.itensServico.length,
        status: a.status,
        pending: a.syncedAt === null,
        motivo: a.syncedAt === null ? motivoDaRecusa(a, recusas) : null,
        resumo: null,
        valor: null,
      })),
    )

    // Sem internet (ou API anterior ao histórico): fica só com o que está no aparelho.
    try {
      const primeira = await buscarHistorico(1)
      if (!ativo()) return
      setHistorico({ itens: primeira.itens, pagina: 1, total: primeira.total })
      setSemHistorico(false)
    } catch {
      if (!ativo()) return
      setHistorico(null)
      setSemHistorico(true)
    }
    setErroMais(false)
  }, [])

  const carregarMais = async () => {
    if (!historico || carregandoMais) return
    setCarregandoMais(true)
    setErroMais(false)
    try {
      const proxima = await buscarHistorico(historico.pagina + 1)
      setHistorico((h) =>
        h && {
          itens: [...h.itens, ...proxima.itens],
          pagina: h.pagina + 1,
          // Página vazia: o total encolheu desde a primeira; para de oferecer mais.
          total: proxima.itens.length === 0 ? h.itens.length : proxima.total,
        },
      )
    } catch {
      setErroMais(true)
    } finally {
      setCarregandoMais(false)
    }
  }

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
        {semHistorico && (
          <View style={styles.aviso}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.ink3} />
            <Text style={styles.avisoText}>
              Não deu para buscar o histórico agora. Mostrando só o que foi registrado neste aparelho.
            </Text>
          </View>
        )}
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
                {r.resumo && (
                  <Text style={styles.rowResumo} numberOfLines={1}>
                    {r.resumo}
                  </Text>
                )}
                <Text style={styles.rowSub}>
                  {r.data ? dataCurta(r.data) : 'Sem data'} · {r.itens} {r.itens === 1 ? 'item' : 'itens'}
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
                {r.valor !== null && r.status !== 'Cancelado' && <Text style={styles.valor}>{brl(r.valor)}</Text>}
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
        {temMais && (
          <Pressable
            onPress={carregarMais}
            disabled={carregandoMais}
            accessibilityRole="button"
            style={({ pressed }) => [styles.mais, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.maisText}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</Text>
          </Pressable>
        )}
        {erroMais && <Text style={styles.erroMais}>Não deu para carregar mais. Tente de novo.</Text>}
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
  rowResumo: { fontSize: 13, color: colors.ink2 },
  motivo: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), marginTop: space(0.5) },
  motivoText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: colors.bad },
  tags: { alignItems: 'flex-end', gap: space(1.5) },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  pendingPill: { flexDirection: 'row', alignItems: 'center', gap: space(1), backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.75) },
  pendingText: { color: colors.warn, fontSize: 10.5, fontWeight: '700' },

  valor: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), backgroundColor: colors.surface2, borderRadius: radius.sm, padding: space(3) },
  avisoText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: colors.ink3 },
  mais: { alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(3) },
  maisText: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  erroMais: { fontSize: 12.5, color: colors.bad, textAlign: 'center' },

  empty: { fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: space(6) },
})
