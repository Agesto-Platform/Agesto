import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, space, font } from './theme'

/** Contador de toque fácil (− valor +). Não desce abaixo de `min`. */
export function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="Diminuir"
        style={({ pressed }) => [styles.btn, (pressed || value <= min) && { opacity: 0.5 }]}
      >
        <Ionicons name="remove" size={18} color={colors.ink2} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        accessibilityRole="button"
        accessibilityLabel="Aumentar"
        style={({ pressed }) => [styles.btn, styles.plus, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={18} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  btn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { backgroundColor: colors.brand, borderColor: colors.brand },
  value: { minWidth: 22, textAlign: 'center', fontSize: 16, fontFamily: font.semibold, color: colors.ink },
})
