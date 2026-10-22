import { useSyncExternalStore } from 'react'

/**
 * Aparência do painel: paleta (Marinho + Vermelho ou Oceano) e modo (claro/escuro).
 * Vive como atributos no <html> (data-palette / data-mode), lidos pelo tokens.css,
 * e fica guardada no navegador. O index.html aplica antes do primeiro quadro.
 */
export type PaletteId = 'marinho' | 'oceano'
export type Mode = 'light' | 'dark'

export const PALETTES: { id: PaletteId; nome: string; cores: string[] }[] = [
  { id: 'marinho', nome: 'Marinho + Vermelho', cores: ['#283E72', '#D62D32', '#F3F1ED'] },
  { id: 'oceano', nome: 'Oceano', cores: ['#0F4448', '#FF5C1F', '#BFE0DA', '#EADFCB'] },
]

const PALETTE_KEY = 'agesto-palette'
const MODE_KEY = 'agesto-mode'

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* armazenamento indisponível: vale só nesta aba */
  }
}

export function getPalette(): PaletteId {
  return document.documentElement.dataset.palette === 'oceano' ? 'oceano' : 'marinho'
}

export function getMode(): Mode {
  return document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'
}

export function setPalette(id: PaletteId): void {
  document.documentElement.dataset.palette = id
  save(PALETTE_KEY, id)
  emit()
}

export function setMode(m: Mode): void {
  document.documentElement.dataset.mode = m
  save(MODE_KEY, m)
  emit()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Paleta e modo atuais, re-renderizando quando mudam. */
export function useTheme(): { palette: PaletteId; mode: Mode } {
  const palette = useSyncExternalStore(subscribe, getPalette)
  const mode = useSyncExternalStore(subscribe, getMode)
  return { palette, mode }
}
