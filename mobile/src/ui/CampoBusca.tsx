import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, space } from './theme'

/** Campo de busca com lupa e botão de limpar (I1). */
export function CampoBusca({
  valor,
  onChange,
  placeholder,
}: {
  valor: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <View style={styles.campo}>
      <Ionicons name="search" size={17} color={colors.ink4} />
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.ink4}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      {valor ? (
        <Pressable onPress={() => onChange('')} accessibilityLabel="Limpar busca" hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={colors.ink4} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: space(2.5) },
})
