import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Linking, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import * as Updates from 'expo-updates'
import { Screen } from '@/ui/Screen'
import { JobCard } from '@/ui/JobCard'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { montarRota } from '@/features/rota/montarRota'
import { sincronizar } from '@/sync/sync'
import { acaoDaAgenda } from '@/features/agenda/acaoDaAgenda'
import { precisaAtualizar } from '@/features/versao/precisaAtualizar'
import { api } from '@/lib/api'
import type { LocalAtendimento } from '@/db/types'
import type { AgendaItem, AppVersao } from '@/types/api'

function dataHoje(): string {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Inicio() {
  const router = useRouter()
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [pendentes, setPendentes] = useState<LocalAtendimento[]>([])
  const [atualizando, setAtualizando] = useState(false)
  const [apkNovo, setApkNovo] = useState<AppVersao | null>(null)

  // Sem loja (DEC-47): pergunta à API se este APK ficou velho. O runtime do
  // expo-updates é a versão nativa instalada; no Expo Go e em dev não há aviso.
  useEffect(() => {
    const instalada = __DEV__ ? null : Updates.runtimeVersion
    if (!instalada) return
    let ativo = true
    api
      .get<AppVersao>('/api/app/versao')
      .then((info) => {
        if (ativo && precisaAtualizar(instalada, info.versaoMinimaAndroid)) setApkNovo(info)
      })
      .catch(() => {
        // Sem internet ou API fora: tenta de novo na próxima abertura.
      })
    return () => {
      ativo = false
    }
  }, [])

  const carregar = useCallback(async (ativo: () => boolean = () => true) => {
    const [items, pend] = await Promise.all([db.getAgenda(), db.getPendingAtendimentos()])
    if (!ativo()) return
    items.sort((a, b) => String(a.dataAgendada).localeCompare(String(b.dataAgendada)))
    setAgenda(items)
    setPendentes(pend)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void carregar(() => active)
      return () => {
        active = false
      }
    }, [carregar]),
  )

  // Puxar para baixo: envia o pendente e baixa o que o Dono mudou no web.
  async function atualizar() {
    setAtualizando(true)
    try {
      await sincronizar()
    } catch {
      // Sem internet: segue com o que já está no aparelho.
    } finally {
      await carregar()
      setAtualizando(false)
    }
  }

  const pending = pendentes.length
  const card = (item: AgendaItem, highlight = false) => {
    const { rota: destino, etiqueta } = acaoDaAgenda(item, pendentes)
    return (
      <JobCard
        key={item.id}
        item={item}
        highlight={highlight}
        etiqueta={etiqueta}
        onPress={destino ? () => router.push(destino) : undefined}
      />
    )
  }

  const proximo = agenda[0]
  const resto = agenda.slice(1)
  const rota = montarRota(agenda)
  const foraDaRota = rota.semEndereco.length + rota.excedentes.length

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.biz}>
          <Text style={styles.bizMark}>A</Text>
        </View>
        <View>
          <Text style={styles.bizName}>Agesto</Text>
          <Text style={styles.bizSub}>Agente de campo</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} />}
      >
        <Pressable
          onPress={() => router.push('/registrar')}
          style={({ pressed }) => [styles.register, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <View style={styles.plus}>
            <Ionicons name="add" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rt}>Registrar atendimento</Text>
            <Text style={styles.rs}>Novo serviço, agora — em poucos toques</Text>
          </View>
        </Pressable>

        {apkNovo && (
          <Pressable
            onPress={apkNovo.urlDownload ? () => Linking.openURL(apkNovo.urlDownload!) : undefined}
            disabled={!apkNovo.urlDownload}
            accessibilityRole={apkNovo.urlDownload ? 'link' : undefined}
            style={({ pressed }) => [styles.apk, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="download-outline" size={20} color={colors.brandInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.apkTitle}>Versão nova do app</Text>
              <Text style={styles.apkText}>
                Sincronize e instale o APK novo para continuar recebendo correções.
                {apkNovo.urlDownload ? ' Toque aqui para baixar.' : ' Peça o link ao responsável.'}
              </Text>
            </View>
          </Pressable>
        )}

        {pending > 0 && (
          <View style={styles.pending}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.warn} />
            <Text style={styles.pendingText}>
              {pending} atendimento{pending === 1 ? '' : 's'} pendente{pending === 1 ? '' : 's'} de envio
            </Text>
          </View>
        )}

        <View style={styles.today}>
          <Text style={styles.todayDate}>{dataHoje()}</Text>
          <Text style={styles.todayCount}>{agenda.length} na agenda</Text>
        </View>

        {rota.url && (
          <View style={{ gap: space(1.5) }}>
            <Pressable
              onPress={() => Linking.openURL(rota.url!)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.rota, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="navigate" size={18} color={colors.brandInk} />
              <Text style={styles.rotaText}>
                Iniciar rota · {rota.paradas.length} parada{rota.paradas.length === 1 ? '' : 's'}
              </Text>
            </Pressable>
            {foraDaRota > 0 && (
              <Text style={styles.rotaHint}>
                {rota.semEndereco.length > 0 &&
                  `${rota.semEndereco.length} visita${rota.semEndereco.length === 1 ? '' : 's'} sem endereço fica${rota.semEndereco.length === 1 ? '' : 'm'} de fora. `}
                {rota.excedentes.length > 0 &&
                  `O Maps aceita até ${rota.paradas.length} paradas; ${rota.excedentes.length === 1 ? 'a última fica' : `as últimas ${rota.excedentes.length} ficam`} para depois.`}
              </Text>
            )}
          </View>
        )}

        {proximo && (
          <View style={styles.section}>
            <Text style={styles.label}>Próximo</Text>
            {card(proximo, true)}
          </View>
        )}

        {resto.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Ainda hoje</Text>
            <View style={{ gap: space(2.75) }}>
              {resto.map((item) => card(item))}
            </View>
          </View>
        )}

        {agenda.length === 0 && (
          <Text style={styles.empty}>Sem atendimentos na agenda de hoje.</Text>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4.5),
    paddingVertical: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  biz: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  bizMark: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bizName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  bizSub: { fontSize: 12.5, color: colors.ink3, marginTop: 1 },

  body: { padding: space(4), gap: space(4) },
  register: { backgroundColor: colors.brand, borderRadius: radius.card, padding: space(5), flexDirection: 'row', alignItems: 'center', gap: space(4) },
  plus: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  rt: { color: '#fff', fontSize: 19, fontWeight: '700' },
  rs: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 3 },

  apk: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.brandSoft, borderRadius: radius.sm, padding: space(3.5) },
  apkTitle: { fontSize: 14, fontWeight: '700', color: colors.brandInk },
  apkText: { fontSize: 12.5, color: colors.brandInk, marginTop: 2 },

  pending: { flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.warnSoft, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.5) },
  pendingText: { fontSize: 12.5, color: colors.warn, fontWeight: '600' },

  today: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(1) },
  todayDate: { fontSize: 15, fontWeight: '600', color: colors.ink },
  todayCount: { fontSize: 13, color: colors.ink3 },

  rota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), backgroundColor: colors.brandSoft, borderRadius: radius.sm, paddingVertical: space(3.25) },
  rotaText: { fontSize: 15, fontWeight: '700', color: colors.brandInk },
  rotaHint: { fontSize: 12.5, color: colors.ink3, paddingHorizontal: space(1) },

  section: { gap: space(2.5) },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.ink4, paddingHorizontal: space(1) },
  empty: { fontSize: 13, color: colors.ink3, paddingHorizontal: space(1) },
})
