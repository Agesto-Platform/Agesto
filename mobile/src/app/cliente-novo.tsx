import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, space } from '@/ui/theme'
import { db } from '@/db/instance'
import { uuid } from '@/lib/uuid'
import { maskCpf, maskPhone } from '@/lib/masks'
import { validateCliente, isValid, type ClienteFormErrors } from '@/features/clientes/validateCliente'
import type { PendingCliente } from '@/db/types'

/** Cadastro rápido de cliente. Também corrige um ainda não enviado (`?editar=<uuid>`). */
export default function ClienteNovo() {
  const router = useRouter()
  const params = useLocalSearchParams<{ editar?: string }>()
  // Cliente ainda não enviado que está sendo corrigido; mantém o uuid e o endereço.
  const [original, setOriginal] = useState<PendingCliente | null>(null)
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [errors, setErrors] = useState<ClienteFormErrors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!params.editar) return
    ;(async () => {
      const local = (await db.getPendingClientes()).find((c) => c.uuid === params.editar && c.syncedAt === null)
      // Já foi enviado (ou não existe mais): não há o que corrigir aqui.
      if (!local) {
        router.back()
        return
      }
      setOriginal(local)
      setNome(local.nome)
      setCpf(maskCpf(local.cpf))
      setTelefone(local.telefone ?? '')
      // Abre já apontando o que o servidor vai recusar.
      setErrors(validateCliente({ nome: local.nome, cpf: local.cpf }))
    })()
  }, [params.editar, router])

  async function salvar() {
    const e = validateCliente({ nome, cpf })
    setErrors(e)
    if (!isValid(e)) return
    setSaving(true)
    try {
      await db.addCliente({
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: null,
        cep: null,
        ...original,
        uuid: original?.uuid ?? uuid(),
        nome: nome.trim(),
        cpf: cpf.trim(),
        telefone: telefone || null,
        syncedAt: null,
      })
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
        <Text style={styles.title}>{original ? 'Corrigir cliente' : 'Novo cliente'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.field}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput value={nome} onChangeText={setNome} placeholder="Nome do cliente" placeholderTextColor={colors.ink4} style={[styles.input, errors.nome && styles.inputErr]} />
          {errors.nome && <Text style={styles.err}>{errors.nome}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CPF *</Text>
          <TextInput value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} keyboardType="number-pad" placeholder="000.000.000-00" placeholderTextColor={colors.ink4} style={[styles.input, errors.cpf && styles.inputErr]} />
          {errors.cpf && <Text style={styles.err}>{errors.cpf}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput value={telefone} onChangeText={(v) => setTelefone(maskPhone(v))} keyboardType="phone-pad" placeholder="(00) 00000-0000" placeholderTextColor={colors.ink4} style={styles.input} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={salvar} disabled={saving} style={({ pressed }) => [styles.save, (saving || pressed) && { opacity: 0.7 }]}>
          <Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar cliente'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line2, backgroundColor: colors.surface },
  close: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },

  body: { padding: space(4), gap: space(4) },
  field: { gap: space(1.5) },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(3), fontSize: 15, color: colors.ink },
  inputErr: { borderColor: colors.bad },
  err: { fontSize: 12, color: colors.bad },

  footer: { padding: space(4), borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  save: { backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: space(3.75), alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
