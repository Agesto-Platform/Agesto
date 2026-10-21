import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Stepper } from '@/ui/Stepper'
import { ValorEditavel, brl } from '@/ui/ValorEditavel'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { buildAtendimento, estadoDoAtendimento, hasItems, type QtyMap } from '@/features/registrar/buildAtendimento'
import { getConfig, DEFAULT_CONFIG } from '@/lib/appConfig'
import { getSugeridos } from '@/lib/sugeridos'
import { isoAgendada, diaLabel } from '@/features/registrar/agendar'
import { materiaisSugeridos } from '@/features/registrar/sugeridos'
import { parseValor, toServicoInput, validateServico, type ServicoFormErrors } from '@/features/servicos/validateServico'
import { toItemAvulso, validateItemAvulso, type ItemAvulso, type ItemAvulsoErrors } from '@/features/registrar/itemAvulso'
import { uuid } from '@/lib/uuid'
import type { LocalAtendimento, PendingServico } from '@/db/types'
import type { AgendaItem, Cliente, Configuracao, Produto, Servico, ServicoSugerido, StatusAtendimento, TipoCobranca } from '@/types/api'

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

/** Dia (0 = hoje) e hora de uma data agendada, para reabrir o seletor. */
function agendaDe(iso: string): { dia: number; hora: string } {
  const d = new Date(iso)
  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dia = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - base.getTime()) / 86_400_000)
  return {
    dia: Math.min(6, Math.max(0, dia)),
    hora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  }
}

/** Grava o valor ajustado do item, ou remove o ajuste (volta ao catálogo). */
function definirPreco(m: Record<number, number>, id: number, v: number | undefined): Record<number, number> {
  const next = { ...m }
  if (v === undefined) delete next[id]
  else next[id] = v
  return next
}

function confirmar(titulo: string, mensagem: string, onSim: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${titulo}\n\n${mensagem}`)) onSim()
    return
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: onSim },
  ])
}

/**
 * Registrar atendimento. Também conclui um atendimento da agenda
 * (`?concluir=<uuid do servidor>`) e corrige um ainda não enviado (`?editar=<uuid>`).
 */
export default function Registrar() {
  const router = useRouter()
  const params = useLocalSearchParams<{ modo?: string; concluir?: string; editar?: string }>()
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [servicosNovos, setServicosNovos] = useState<PendingServico[]>([])
  const [servicoNovoQty, setServicoNovoQty] = useState<Record<string, number>>({})
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoDescricao, setNovoDescricao] = useState('')
  const [novoTipo, setNovoTipo] = useState<TipoCobranca>('Empreitada')
  const [novoValor, setNovoValor] = useState('')
  const [novoErros, setNovoErros] = useState<ServicoFormErrors>({})
  const [avulsos, setAvulsos] = useState<ItemAvulso[]>([])
  const [avulsoAberto, setAvulsoAberto] = useState(false)
  const [avulsoDescricao, setAvulsoDescricao] = useState('')
  const [avulsoQtd, setAvulsoQtd] = useState('1')
  const [avulsoValor, setAvulsoValor] = useState('')
  const [avulsoErros, setAvulsoErros] = useState<ItemAvulsoErrors>({})

  const [clienteKey, setClienteKey] = useState<string | undefined>(undefined)
  const [servicoQty, setServicoQty] = useState<QtyMap>({})
  const [produtoQty, setProdutoQty] = useState<QtyMap>({})
  const [precoServico, setPrecoServico] = useState<Record<number, number>>({})
  const [precoProduto, setPrecoProduto] = useState<Record<number, number>>({})
  // Conclusão de atendimento da agenda (já existe no servidor).
  const [agendaItem, setAgendaItem] = useState<AgendaItem | null>(null)
  // Atendimento ainda não enviado que está sendo corrigido.
  const [original, setOriginal] = useState<LocalAtendimento | null>(null)
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
      const [ref, pend, agenda, locais] = await Promise.all([
        db.getClientes(),
        db.getPendingClientes(),
        db.getAgenda(),
        db.getAtendimentos(),
      ])
      // Uma conclusão ainda não enviada abre como correção, não como uma segunda conclusão.
      const alvo = params.editar ?? params.concluir
      const local = alvo ? locais.find((a) => a.uuid === alvo && a.syncedAt === null) : undefined
      const daAgenda = (local?.existente ?? !!params.concluir) ? agenda.find((a) => a.uuid === alvo) : undefined
      if (local) {
        const e = estadoDoAtendimento(local)
        setOriginal(local)
        setServicoQty(e.servicoQty)
        setProdutoQty(e.produtoQty)
        setServicoNovoQty(e.servicoNovoQty)
        setAvulsos(e.avulsos)
        setPrecoServico(e.precos.servico)
        setPrecoProduto(e.precos.produto)
        setStatus(local.status)
        setClienteKey(local.clienteUuid ? `p${local.clienteUuid}` : `r${local.clienteId}`)
        if (local.dataAgendada) {
          const { dia, hora: h } = agendaDe(local.dataAgendada)
          setModo('agendar')
          setDiaOffset(dia)
          setHora(h)
        }
      }
      if (daAgenda) {
        setAgendaItem(daAgenda)
        setClienteKey(`r${daAgenda.clienteId}`)
      }
      setClientes([
        ...pend
          .filter((c) => c.syncedAt === null)
          .map((c) => ({ key: `p${c.uuid}`, id: null, uuid: c.uuid, nome: c.nome, sub: c.telefone ?? c.cpf, pendente: true })),
        ...ref.map((c) => ({ key: `r${c.id}`, id: c.id, uuid: null, nome: c.nome, sub: enderecoResumo(c), pendente: false })),
      ])
      setProdutos(await db.getProdutos())
      setServicos(await db.getServicos())
      setServicosNovos((await db.getPendingServicos()).filter((s) => s.syncedAt === null))
      setConfig(await getConfig(db))
      setSugeridos(await getSugeridos(db))
      setConfigLoaded(true)
    })()
    // Carrega uma vez ao abrir a tela; os parâmetros vêm da rota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Conclusão: o que já estava lançado + o que o agente acrescentar.
  const concluindo = agendaItem !== null || original?.existente === true

  // Agendar só existe no modo Flexível (solo); no Fixa o agente só registra/conclui (walk-in).
  // Só depois da config carregar, pra não piscar o segmento em empresas Fixa.
  const podeAgendar = configLoaded && config.modoAgendaAgente === 'Flexivel' && !concluindo
  const agendando = podeAgendar && modo === 'agendar'
  const dataAgendada = agendando ? isoAgendada(diaOffset, hora) : null

  // Empreitada com quantidade 2 = duas unidades cobradas (uma linha por unidade, DEC-04).
  const estimate = useMemo(() => {
    const s = servicos.reduce((acc, sv) => acc + (servicoQty[sv.id] || 0) * (precoServico[sv.id] ?? sv.valorHora ?? sv.valorEmpreitada ?? 0), 0)
    const n = servicosNovos.reduce((acc, sv) => acc + (servicoNovoQty[sv.uuid] || 0) * (sv.valorHora ?? sv.valorEmpreitada ?? 0), 0)
    const p = produtos.reduce((acc, pr) => acc + (produtoQty[pr.id] || 0) * (precoProduto[pr.id] ?? pr.preco), 0)
    const a = avulsos.reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)
    return (agendaItem?.valorTotal ?? 0) + s + n + p + a
  }, [servicos, servicosNovos, produtos, servicoQty, servicoNovoQty, produtoQty, avulsos, precoServico, precoProduto, agendaItem])

  // Serviço fora do catálogo: entra pendente e vai para revisão do Dono (DEC-36).
  const podeCriarServico = configLoaded && config.agenteCadastraServico !== false

  function fecharNovoServico() {
    setNovoAberto(false)
    setNovoDescricao('')
    setNovoValor('')
    setNovoErros({})
  }

  async function adicionarServico() {
    const e = validateServico({ descricao: novoDescricao, valor: novoValor })
    setNovoErros(e)
    if (Object.keys(e).length > 0) return
    const novo: PendingServico = {
      uuid: uuid(),
      ...toServicoInput(novoDescricao, novoTipo, parseValor(novoValor)!),
      syncedAt: null,
    }
    await db.addServico(novo)
    setServicosNovos((l) => [...l, novo])
    setServicoNovoQty((m) => ({ ...m, [novo.uuid]: 1 }))
    fecharNovoServico()
  }

  function fecharAvulso() {
    setAvulsoAberto(false)
    setAvulsoDescricao('')
    setAvulsoQtd('1')
    setAvulsoValor('')
    setAvulsoErros({})
  }

  // Item fora do catálogo, como o "Item avulso" do web: não mexe no estoque.
  function adicionarAvulso() {
    const form = { descricao: avulsoDescricao, quantidade: avulsoQtd, valor: avulsoValor }
    const e = validateItemAvulso(form)
    setAvulsoErros(e)
    if (Object.keys(e).length > 0) return
    setAvulsos((l) => [...l, toItemAvulso(form)])
    fecharAvulso()
  }

  const cliente: ClienteOpcao | undefined =
    clientes.find((c) => c.key === clienteKey) ??
    (agendaItem
      ? { key: `r${agendaItem.clienteId}`, id: agendaItem.clienteId, uuid: null, nome: agendaItem.clienteNome, sub: agendaItem.enderecoResumo ?? '', pendente: false }
      : undefined)

  // Concluir não exige item novo: o Dono pode ter lançado tudo no web.
  const podeSalvar =
    cliente !== undefined &&
    (concluindo || hasItems(servicoQty, produtoQty, servicoNovoQty, avulsos)) &&
    (!agendando || dataAgendada !== null) &&
    !saving

  function excluir() {
    if (!original) return
    confirmar(
      concluindo ? 'Descartar conclusão?' : 'Excluir atendimento?',
      concluindo
        ? 'O atendimento volta a ficar pendente na agenda. O que você lançou aqui não será enviado.'
        : 'Ele ainda não foi enviado e será apagado deste aparelho.',
      async () => {
        await db.deleteAtendimento(original.uuid)
        router.back()
      },
    )
  }

  async function salvar() {
    if (cliente === undefined) return
    if (agendando && dataAgendada === null) return
    setSaving(true)
    try {
      await db.addAtendimento(
        buildAtendimento({
          uuid: original?.uuid ?? agendaItem?.uuid,
          dataRegistro: original?.dataRegistro,
          existente: concluindo,
          clienteId: cliente.id,
          clienteUuid: cliente.uuid,
          status: agendando ? 'Pendente' : status,
          servicoQty,
          produtoQty,
          servicoNovoQty,
          avulsos,
          precos: { servico: precoServico, produto: precoProduto },
          empreitada: {
            ids: servicos.filter((sv) => sv.tipoCobranca === 'Empreitada').map((sv) => sv.id),
            uuids: servicosNovos.filter((sv) => sv.tipoCobranca === 'Empreitada').map((sv) => sv.uuid),
          },
          dataAgendada: concluindo ? null : dataAgendada,
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
        <Text style={[styles.title, { flex: 1 }]}>
          {concluindo ? 'Concluir atendimento' : original ? 'Corrigir atendimento' : 'Registrar atendimento'}
        </Text>
        {original && (
          <Pressable onPress={excluir} accessibilityLabel={concluindo ? 'Descartar conclusão' : 'Excluir atendimento'} style={styles.close}>
            <Ionicons name="trash-outline" size={20} color={colors.bad} />
          </Pressable>
        )}
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

        {/* Cliente: fixo na conclusão; o que já foi lançado aparece só para leitura */}
        <Text style={styles.label}>Cliente</Text>
        {concluindo && cliente && (
          <View style={[styles.row, styles.rowOn]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.brandInk }]}>{cliente.nome}</Text>
              {cliente.sub ? <Text style={styles.rowSub}>{cliente.sub}</Text> : null}
            </View>
          </View>
        )}
        {concluindo && (agendaItem?.itens?.length ?? 0) > 0 && (
          <>
            <Text style={styles.label}>Já lançado</Text>
            <View style={styles.lancados}>
              {agendaItem!.itens!.map((it, i) => (
                <View key={i} style={styles.lancado}>
                  <Text style={styles.lancadoNome} numberOfLines={1}>
                    {it.quantidade} × {it.descricao}
                  </Text>
                  <Text style={styles.lancadoValor}>{brl(it.subtotal)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        <View style={{ gap: space(2), display: concluindo ? 'none' : 'flex' }}>
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
        <Text style={styles.label}>{concluindo ? 'Acrescentar serviços' : 'Serviços'}</Text>
        <View style={{ gap: space(2) }}>
          {servicos.map((sv) => (
            <View key={sv.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{sv.descricao}</Text>
                <ValorEditavel
                  catalogo={sv.valorHora ?? sv.valorEmpreitada ?? 0}
                  valor={precoServico[sv.id]}
                  sufixo={sv.tipoCobranca === 'PorHora' ? '/h' : ''}
                  rotulo={sv.descricao}
                  onChange={(v) => setPrecoServico((m) => definirPreco(m, sv.id, v))}
                />
              </View>
              <Stepper value={servicoQty[sv.id] || 0} onChange={(v) => setServicoQty((m) => ({ ...m, [sv.id]: v }))} />
            </View>
          ))}
          {servicosNovos.map((sv) => (
            <View key={sv.uuid} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{sv.descricao}</Text>
                <Text style={styles.rowSub}>
                  {brl(sv.valorHora ?? sv.valorEmpreitada ?? 0)}
                  {sv.tipoCobranca === 'PorHora' ? '/h' : ''} · Novo · não sincronizado
                </Text>
              </View>
              <Stepper
                value={servicoNovoQty[sv.uuid] || 0}
                onChange={(v) => setServicoNovoQty((m) => ({ ...m, [sv.uuid]: v }))}
              />
            </View>
          ))}

          {podeCriarServico && !novoAberto && (
            <Pressable onPress={() => setNovoAberto(true)} style={({ pressed }) => [styles.novoBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="add" size={18} color={colors.brandInk} />
              <Text style={styles.novoBtnText}>Novo serviço</Text>
            </Pressable>
          )}

          {novoAberto && (
            <View style={styles.novoCard}>
              <Text style={styles.novoTitulo}>Novo serviço</Text>
              <TextInput
                value={novoDescricao}
                onChangeText={setNovoDescricao}
                placeholder="Descrição (ex.: Limpeza de dreno)"
                placeholderTextColor={colors.ink4}
                maxLength={200}
                style={[styles.input, novoErros.descricao && styles.inputErr]}
              />
              {novoErros.descricao && <Text style={styles.err}>{novoErros.descricao}</Text>}
              <View style={styles.seg}>
                {(['Empreitada', 'PorHora'] as TipoCobranca[]).map((t) => (
                  <Pressable key={t} onPress={() => setNovoTipo(t)} style={[styles.segBtn, novoTipo === t && styles.segBtnOn]}>
                    <Text style={[styles.segText, novoTipo === t && styles.segTextOn]}>
                      {t === 'Empreitada' ? 'Preço fechado' : 'Por hora'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={novoValor}
                onChangeText={setNovoValor}
                placeholder={novoTipo === 'PorHora' ? 'Valor da hora (R$)' : 'Valor do serviço (R$)'}
                placeholderTextColor={colors.ink4}
                keyboardType="decimal-pad"
                style={[styles.input, novoErros.valor && styles.inputErr]}
              />
              {novoErros.valor && <Text style={styles.err}>{novoErros.valor}</Text>}
              <Text style={styles.novoHint}>Entra no catálogo depois que o responsável revisar.</Text>
              <View style={styles.novoAcoes}>
                <Pressable onPress={fecharNovoServico} style={styles.novoCancelar}>
                  <Text style={styles.novoCancelarText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={adicionarServico} style={styles.novoAdicionar}>
                  <Text style={styles.novoAdicionarText}>Adicionar</Text>
                </Pressable>
              </View>
            </View>
          )}
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
        <Text style={styles.label}>{concluindo ? 'Acrescentar produtos' : 'Produtos'}</Text>
        <View style={{ gap: space(2) }}>
          {produtos.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.nome}</Text>
                <ValorEditavel
                  catalogo={p.preco}
                  valor={precoProduto[p.id]}
                  rotulo={p.nome}
                  onChange={(v) => setPrecoProduto((m) => definirPreco(m, p.id, v))}
                />
                {config.controlaEstoque && <Text style={styles.rowSub}>{p.quantidadeEstoque} em estoque</Text>}
              </View>
              <Stepper value={produtoQty[p.id] || 0} onChange={(v) => setProdutoQty((m) => ({ ...m, [p.id]: v }))} />
            </View>
          ))}
          {avulsos.map((it, i) => (
            <View key={`avulso-${i}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{it.descricao}</Text>
                <Text style={styles.rowSub}>
                  {it.quantidade} × {brl(it.precoUnitario)} · Avulso
                </Text>
              </View>
              <Pressable
                onPress={() => setAvulsos((l) => l.filter((_, j) => j !== i))}
                accessibilityLabel={`Remover ${it.descricao}`}
                style={styles.close}
              >
                <Ionicons name="trash-outline" size={18} color={colors.ink3} />
              </Pressable>
            </View>
          ))}

          {!avulsoAberto && (
            <Pressable onPress={() => setAvulsoAberto(true)} style={({ pressed }) => [styles.novoBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="add" size={18} color={colors.brandInk} />
              <Text style={styles.novoBtnText}>Item avulso</Text>
            </Pressable>
          )}

          {avulsoAberto && (
            <View style={styles.novoCard}>
              <Text style={styles.novoTitulo}>Item avulso</Text>
              <TextInput
                value={avulsoDescricao}
                onChangeText={setAvulsoDescricao}
                placeholder="Descrição (ex.: Tubo de cobre 1/4)"
                placeholderTextColor={colors.ink4}
                maxLength={200}
                style={[styles.input, avulsoErros.descricao && styles.inputErr]}
              />
              {avulsoErros.descricao && <Text style={styles.err}>{avulsoErros.descricao}</Text>}
              <View style={styles.avulsoLinha}>
                <TextInput
                  value={avulsoQtd}
                  onChangeText={setAvulsoQtd}
                  placeholder="Qtd."
                  placeholderTextColor={colors.ink4}
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel="Quantidade"
                  style={[styles.input, styles.avulsoQtd, avulsoErros.quantidade && styles.inputErr]}
                />
                <TextInput
                  value={avulsoValor}
                  onChangeText={setAvulsoValor}
                  placeholder="Valor unitário (R$)"
                  placeholderTextColor={colors.ink4}
                  keyboardType="decimal-pad"
                  style={[styles.input, { flex: 1 }, avulsoErros.valor && styles.inputErr]}
                />
              </View>
              {(avulsoErros.quantidade || avulsoErros.valor) && (
                <Text style={styles.err}>{avulsoErros.quantidade ?? avulsoErros.valor}</Text>
              )}
              <Text style={styles.novoHint}>Fica só neste atendimento e não mexe no estoque.</Text>
              <View style={styles.novoAcoes}>
                <Pressable onPress={fecharAvulso} style={styles.novoCancelar}>
                  <Text style={styles.novoCancelarText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={adicionarAvulso} style={styles.novoAdicionar}>
                  <Text style={styles.novoAdicionarText}>Adicionar</Text>
                </Pressable>
              </View>
            </View>
          )}
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
            {saving
              ? 'Salvando…'
              : agendando
                ? 'Agendar atendimento'
                : concluindo && status === 'Concluido'
                  ? 'Concluir atendimento'
                  : 'Salvar atendimento'}
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

  novoBtn: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), alignSelf: 'flex-start', paddingVertical: space(2), paddingHorizontal: space(1) },
  novoBtnText: { fontSize: 14, fontWeight: '700', color: colors.brandInk },
  novoCard: { gap: space(2.5), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, padding: space(3.5) },
  novoTitulo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  novoHint: { fontSize: 12, color: colors.ink3 },
  novoAcoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2) },
  novoCancelar: { paddingVertical: space(2.5), paddingHorizontal: space(4), borderRadius: radius.sm },
  novoCancelarText: { fontSize: 14, fontWeight: '600', color: colors.ink3 },
  novoAdicionar: { backgroundColor: colors.brand, paddingVertical: space(2.5), paddingHorizontal: space(4), borderRadius: radius.sm },
  novoAdicionarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  input: { fontSize: 15, color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(2.5), paddingHorizontal: space(3) },
  inputErr: { borderColor: colors.bad },
  err: { fontSize: 12, color: colors.bad, marginTop: -space(1) },
  avulsoLinha: { flexDirection: 'row', gap: space(2) },
  avulsoQtd: { width: 80, textAlign: 'center' },
  lancados: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  lancado: { flexDirection: 'row', justifyContent: 'space-between', gap: space(3), paddingVertical: space(1.5) },
  lancadoNome: { flex: 1, fontSize: 14, color: colors.ink2 },
  lancadoValor: { fontSize: 14, fontWeight: '600', color: colors.ink },

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
  estimate: { flexShrink: 0 },
  estLabel: { fontSize: 11, color: colors.ink4, textTransform: 'uppercase', letterSpacing: 0.5 },
  estValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  save: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: space(3.75), alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
