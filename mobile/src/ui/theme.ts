/**
 * Design tokens do app do agente (mobile). Tema claro fixo.
 *
 * Redesign Azul petróleo (#1D4E6B, o mesmo tom padrão do painel web): uma cor
 * só para agir (`brand`), com os mesmos cinzas do painel. O resto é branco, cinza
 * bem claro e o próprio petróleo em transparência — `brandSoft` (8%) para
 * fundos selecionados e `brandLine` (20%) para bordas. Verde, âmbar e vermelho
 * aparecem só em selos e avisos de estado. Texto em `ink`..`ink3` passa AA
 * (4.5:1) sobre `bg` e `surface`; `ink4` é só para ícones e placeholder.
 */
export const colors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surface2: '#F1F3F5',

  ink: '#141F29',
  ink2: '#3A4753',
  ink3: '#5D6974',
  ink4: '#8A949C',

  line: '#E3E8EC',
  line2: '#EEF1F3',

  brand: '#1D4E6B',
  brandSoft: '#EDF1F3',
  brandLine: '#D2DCE1',
  brandInk: '#163E56',

  good: '#2B6E50',
  goodSoft: '#EAF3EE',
  warn: '#8A5A10',
  warnSoft: '#F8F0E1',
  bad: '#A8352E',
  badSoft: '#FBECEA',
} as const

/**
 * Geist, a mesma fonte do painel web. Cada peso é uma família própria: no
 * Android `fontWeight` não escolhe o arquivo da fonte, então os estilos usam
 * `fontFamily: font.<peso>` em vez de `fontWeight`.
 */
export const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const

export const radius = {
  card: 16,
  sm: 12,
  pill: 999,
} as const

/** Escala de espaçamento base 4. */
export const space = (n: number): number => n * 4
