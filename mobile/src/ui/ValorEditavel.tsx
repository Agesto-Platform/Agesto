import { useState } from 'react'
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, space } from './theme'
import { parseValor } from '@/features/servicos/validateServico'

/** R$ sem centavos quando o valor é inteiro; com os dois dígitos quando não é. */
export const brl = (v: number) => {
  const casas = Number.isInteger(v) ? 0 : 2
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v)
}

/**
 * Valor do item com ajuste no atendimento (DEC-23), como no web: toque para
 * mudar. Vazio ou igual ao catálogo volta ao valor do catálogo.
 */
export function ValorEditavel({
  catalogo,
  valor,
  sufixo = '',
  rotulo,
  onChange,
}: {
  catalogo: number
  valor: number | undefined
  sufixo?: string
  rotulo: string
  onChange: (v: number | undefined) => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const atual = valor ?? catalogo

  function abrir() {
    setTexto(String(atual).replace('.', ','))
    setEditando(true)
  }

  function fechar() {
    setEditando(false)
    if (!texto.trim()) return onChange(undefined)
    const v = parseValor(texto)
    // Valor ilegível mantém o que estava.
    if (v === null || v > 999999.99) return
    onChange(v === catalogo ? undefined : v)
  }

  if (editando) {
    return (
      <TextInput
        autoFocus
        value={texto}
        onChangeText={setTexto}
        onBlur={fechar}
        onSubmitEditing={fechar}
        keyboardType="decimal-pad"
        returnKeyType="done"
        accessibilityLabel={`Valor de ${rotulo}`}
        style={styles.input}
      />
    )
  }

  return (
    <Pressable
      onPress={abrir}
      accessibilityRole="button"
      accessibilityLabel={`Ajustar valor de ${rotulo}`}
      hitSlop={8}
      style={styles.row}
    >
      <Text style={[styles.valor, valor !== undefined && styles.ajustado]}>
        {brl(atual)}
        {sufixo}
      </Text>
      {valor !== undefined && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>ajustado</Text>
        </View>
      )}
      <Ionicons name="pencil" size={12} color={colors.ink4} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), alignSelf: 'flex-start', marginTop: 2 },
  valor: { fontSize: 12.5, color: colors.ink3 },
  ajustado: { color: colors.brandInk, fontWeight: '700' },
  tag: { backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: 1 },
  tagText: { fontSize: 10.5, fontWeight: '700', color: colors.brandInk },
  input: {
    marginTop: 2,
    alignSelf: 'flex-start',
    minWidth: 110,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
})
