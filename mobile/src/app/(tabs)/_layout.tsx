import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, font } from '@/ui/theme'
import { useSincronizacaoAutomatica } from '@/sync/useSincronizacaoAutomatica'

// No RN 0.88 a cor da aba pode vir como número ou null; as do tema são texto.
const corDoIcone = (c: unknown) => (typeof c === 'string' ? c : undefined)

export default function TabsLayout() {
  useSincronizacaoAutomatica()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line2 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.semibold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={corDoIcone(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={corDoIcone(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="atendimentos"
        options={{
          title: 'Atend.',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={corDoIcone(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={corDoIcone(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" color={corDoIcone(color)} size={size} />,
        }}
      />
    </Tabs>
  )
}
