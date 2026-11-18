import type { ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from './theme'

/** Container base de tela: safe-area + fundo do tema. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // A faixa da barra de status fica branca, junto do cabeçalho; o conteúdo, no cinza claro.
  safe: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, backgroundColor: colors.bg },
})
