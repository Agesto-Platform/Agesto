/**
 * Configuração de runtime via env EXPO_PUBLIC_* (inlinadas no build — por isso
 * o acesso literal a process.env.EXPO_PUBLIC_X). Mock só liga explicitamente
 * (EXPO_PUBLIC_USE_MOCKS=true) e nunca em release.
 */
export interface AppEnv {
  apiBaseUrl?: string
  useMocks?: string
}

export interface RuntimeConfig {
  apiBaseUrl: string
  useMocks: boolean
}

/** Regra pura (testável): dev tem fallback local; release exige API https e sem mock. */
export function resolveConfig(env: AppEnv, isDev: boolean): RuntimeConfig {
  if (isDev) {
    return {
      apiBaseUrl: env.apiBaseUrl || 'http://localhost:5000',
      useMocks: env.useMocks === 'true',
    }
  }
  if (!env.apiBaseUrl || !env.apiBaseUrl.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL https é obrigatória em release.')
  }
  return { apiBaseUrl: env.apiBaseUrl, useMocks: false }
}

export const config = resolveConfig(
  {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    useMocks: process.env.EXPO_PUBLIC_USE_MOCKS,
  },
  typeof __DEV__ !== 'undefined' && __DEV__,
)
