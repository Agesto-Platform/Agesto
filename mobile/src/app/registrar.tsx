import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Stepper } from '@/ui/Stepper'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { buildAtendimento, hasItems, type QtyMap } from '@/features/registrar/buildAtendimento'
import { getConfig, DEFAULT_CONFIG } from '@/lib/appConfig'
import { getSugeridos } from '@/lib/sugeridos'
import { isoAgendada, diaLabel } from '@/features/registrar/agendar'
import { materiaisSugeridos } from '@/features/registrar/sugeridos'
import type { Cliente, Configuracao, Produto, Servico, ServicoSugerido, StatusAtendimento } from '@/types/api'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

/** Cliente selecionável: da Carga (id do servidor) ou criado offline (uuid). */
interface ClienteOpcao {
  key: string
  id: number | null
  uuid: string | null
  nome: string
  sub: string
  pendente: boolean
}

function enderecoResumo(c: Cliente): string {
  const rua = c.logradouro ? `${c.logradouro}${c.numero ? ', ' + c.numero : ''}` : ''
  const local = c.bairro ?? c.cidade ?? ''
  return [rua, local].filter(Boolean).join(' — ')
}

export default function Registrar() {
  const router = useRouter()
  const params = useLocalSearchParams<{ modo?: string }>()
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])

  const [clienteKey, setClienteKey] = useState<string | undefined>(undefined)
  const [servicoQty, setServicoQty] = useState<QtyMap>({})
  const [produtoQty, setProdutoQty] = useState<QtyMap>({})
  const [status, setStatus] = useState<StatusAtendimento>('Concluido')
  const [saving, setSaving] = useState(false)

  const [config, setConfig] = useState<Configuracao>(DEFAULT_CONFIG)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [sugeridos, setSugeridos] = useState<ServicoSugerido[]>([])
  const [modo, setModo] = useState<'agora' | 'agendar'>(params.modo === 'agendar' ? 'agendar' : 'agora')
  const [diaOffset, setDiaOffset] = useState(0)
  const [hora, setHora] = useState('09:00')

  useEffect(() => {
    ;(async () => {
      const [ref, pend] = await Promise.all([db.getClientes(), db.getPendingClientes()])
      setClientes([
        ...pend
          .filter((c) => c.syncedAt === null)
          .map((c) => ({ key: `p${c.uuid}`, id: null, uuid: c.uuid, nome: c.nome, sub: c.telefone ?? c.cpf, pendente: true })),
        ...ref.map((c) => ({ key: `r${c.id}`, id: c.id, uuid: null, nome: c.nome, sub: enderecoResumo(c), pendente: false })),
      ])
      setProdutos(await db.getProdutos())
      setServicos(await db.getServicos())
      setConfig(await getConfig(db))
      setSugeridos(await getSugeridos(db))
      setConfigLoaded(true)
    })()
  }, [])

  // Materiais sugeridos dos serviços selecionados que existem no catálogo local.
  const materiais = materiaisSugeridos(sugeridos, servicoQty).filter((m) =>
    produtos.some((p) => p.id === m.produtoId),
  )

  function addSugeridos() {
    setProdutoQty((m) => {
      const next = { ...m }
      for (const it of materiais) next[it.produtoId] = Math.max(next[it.produtoId] ?? 0, it.quantidade)
      return next
    })
  }

  // Agendar só existe no modo Flexível (solo); no Fixa o agente só registra/conclui (walk-in).
  // Só depois da config carregar, pra não piscar o segmento em empresas Fixa.
  const podeAgendar = configLoaded && config.modoAgendaAgente === 'Flexivel'
  const agendando = podeAgendar && modo === 'agendar'
  const dataAgendada = agendando ? isoAgendada(diaOffset, hora) : null

  const estimate = useMemo(() => {
    const s = servicos.reduce((acc, sv) => acc + (servicoQty[sv.id] || 0) * (sv.valorHora ?? sv.valorEmpreitada ?? 0), 0)
    const p = produtos.reduce((acc, pr) => acc + (produtoQty[pr.id] || 0) * pr.preco, 0)
    return s + p
  }, [servicos, produtos, servicoQty, produtoQty])

  const cliente = clientes.find((c) => c.key === clienteKey)

  const podeSalvar =
    cliente !== undefined &&
    hasItems(servicoQty, produtoQty) &&
    (!agendando || dataAgendada !== null) &&
    !saving

  async function salvar() {
    if (cliente === undefined) return
    if (agendando && dataAgendada === null) return
    setSaving(true)
    try {
      await db.addAtendimento(
        buildAtendimento({
          clienteId: cliente.id,
          clienteUuid: cliente.uuid,
          status: agendando ? 'Pendente' : status,
          servicoQty,
          produtoQty,
          dataAgendada,
        }),
      )
      router.back()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Fechar" style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink2} />
        </Pressable>
        <Text style={styles.title}>Registrar atendimento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Modo: registrar agora vs agendar (só no modo Flexível) */}
        {podeAgendar && (
          <View style={styles.seg}>
            {(['agora', 'agendar'] as const).map((m) => (
              <Pressable key={m} onPress={() => setModo(m)} style={[styles.segBtn, modo === m && styles.segBtnOn]}>
                <Text style={[styles.segText, modo === m && styles.segTextOn]}>
                  {m === 'agora' ? 'Registrar agora' : 'Agendar'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Seletor de agenda */}
        {agendando && (
          <View style={{ gap: space(2.5) }}>
            <Text style={styles.label}>Quando</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
              {[0, 1, 2, 3, 4, 5, 6].map((off) => (
                <Pressable key={off} onPress={() => setDiaOffset(off)} style={[styles.chip, diaOffset === off && styles.chipOn]}>
                  <Text style={[styles.chipText, diaOffset === off && styles.chipTextOn]}>{diaLabel(off)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.horaRow}>
              <Text style={styles.horaLabel}>Horário</Text>
              <TextInput
                value={hora}
                onChangeText={setHora}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={[styles.horaInput, dataAgendada === null && styles.horaInputErr]}
              />
            </View>
          </View>
        )}

        {/* Cliente */}
        <Text style={styles.label}>Cliente</Text>
        <View style={{ gap: space(2) }}>
          {clientes.map((c) => {
            const on = c.key === clienteKey
            return (
              <Pressable
                key={c.key}
                onPress={() => setClienteKey(c.key)}
                style={[styles.row, on && styles.rowOn]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, on && { color: colors.brandInk }]}>{c.nome}</Text>
                  {c.sub || c.pendente ? (
                    <Text style={styles.rowSub}>{[c.pendente ? 'Novo · não sincronizado' : '', c.sub].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </View>
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={on ? colors.brand : colors.ink4}
                />
              </Pressable>
            )
          })}
        </View>

        {/* Serviços */}
        <Text style={styles.label}>Serviços</Text>
        <View style={{ gap: space(2) }}>
          {servicos.map((sv) => (
            <View key={sv.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{sv.descricao}</Text>
                <Text style={styles.rowSub}>{brl(sv.valorHora ?? sv.valorEmpreitada ?? 0)}</Text>
              </View>
              <Stepper value={servicoQty[sv.id] || 0} onChange={(v) => setServicoQty((m) => ({ ...m, [sv.id]: v }))} />
            </View>
          ))}
        </View>

        {/* Materiais sugeridos dos serviços escolhidos */}
        {materiais.length > 0 && (
          <Pressable onPress={addSugeridos} style={({ pressed }) => [styles.sugerido, pressed && { opacity: 0.9 }]}>
            <Ionicons name="add-circle-outline" size={18} color={colors.brandInk} />
            <Text style={styles.sugeridoText}>
              Materiais sugeridos ({materiais.length})
            </Text>
          </Pressable>
        )}

        {/* Produtos */}
        <Text style={styles.label}>Produtos</Text>
        <View style={{ gap: space(2) }}>
          {produtos.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.nome}</Text>
                <Text style={styles.rowSub}>
                  {brl(p.preco)}
                  {config.controlaEstoque ? ` · ${p.quantidadeEstoque} em estoque` : ''}
                </Text>
              </View>
              <Stepper value={produtoQty[p.id] || 0} onChange={(v) => setProdutoQty((m) => ({ ...m, [p.id]: v }))} />
            </View>
          ))}
        </View>

        {/* Status — oculto ao agendar (agendamento entra como Pendente) */}
        {!agendando && (
          <>
            <Text style={styles.label}>Status</Text>
            <View style={styles.seg}>
              {(['Concluido', 'Pendente'] as StatusAtendimento[]).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStatus(s)}
                  style={[styles.segBtn, status === s && styles.segBtnOn]}
                >
                  <Text style={[styles.segText, status === s && styles.segTextOn]}>
                    {s === 'Concluido' ? 'Concluído' : 'Pendente'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.estimate}>
          <Text style={styles.estLabel}>Estimado</Text>
          <Text style={styles.estValue}>{brl(estimate)}</Text>
        </View>
        <Pressable
          onPress={salvar}
          disabled={!podeSalvar}
          style={({ pressed }) => [styles.save, (!podeSalvar || pressed) && { opacity: 0.6 }]}
        >
          <Text style={styles.saveText}>
            {saving ? 'Salvando…' : agendando ? 'Agendar atendimento' : 'Salvar atendimento'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
    backgroundColor: colors.surface,
  },
  close: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },

  body: { padding: space(4), gap: space(2.5), paddingBottom: space(6) },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.ink4, marginTop: space(2) },
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
  rowOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },

  sugerido: { flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.brandSoft, borderRadius: radius.sm, paddingHorizontal: space(3.5), paddingVertical: space(3), alignSelf: 'flex-start' },
  sugeridoText: { fontSize: 13.5, fontWeight: '700', color: colors.brandInk },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2.25), borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.ink3 },
  chipTextOn: { color: colors.brandInk },
  horaRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  horaLabel: { fontSize: 13.5, color: colors.ink2, fontWeight: '600' },
  horaInput: { flex: 0, minWidth: 80, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(2), paddingHorizontal: space(3) },
  horaInputErr: { borderColor: colors.bad },

  seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.sm - 3, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.surface },
  segText: { fontSize: 13.5, fontWeight: '600', color: colors.ink3 },
  segTextOn: { color: colors.ink },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  estimate: { flex: 0 },
  estLabel: { fontSize: 11, color: colors.ink4, textTransform: 'uppercase', letterSpacing: 0.5 },
  estValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  save: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: space(3.75), alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
