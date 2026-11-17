import { jest } from '@jest/globals'

// Testes rodam contra a camada de mock: liga explicitamente (o default agora é off).
process.env.EXPO_PUBLIC_USE_MOCKS = 'true'

// O jest-expo 58 carrega o expo-notifications de verdade e algumas chamadas
// nunca respondem no jest. Nos testes, o aparelho não dá permissão de aviso;
// o avisosDoDia.test.ts troca por um mock próprio.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  setNotificationChannelAsync: async () => null,
  getAllScheduledNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: async () => undefined,
  scheduleNotificationAsync: async () => '',
  addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
  setNotificationHandler: () => undefined,
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))
