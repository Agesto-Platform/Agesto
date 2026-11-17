/**
 * Design tokens do app do agente (mobile). Tema claro fixo.
 *
 * Redesign Petróleo: uma cor só para agir (`brand`). O resto é branco, cinza
 * bem claro e o próprio petróleo em transparência — `brandSoft` (8%) para
 * fundos selecionados e `brandLine` (20%) para bordas. Verde, âmbar e vermelho
 * aparecem só em selos e avisos de estado. Texto em `ink`..`ink3` passa AA
 * (4.5:1) sobre `bg` e `surface`; `ink4` é só para ícones e placeholder.
 */
export const colors = {
  bg: '#F6F7F7',
  surface: '#FFFFFF',
  surface2: '#F1F3F4',

  ink: '#14212A',
  ink2: '#3A4850',
  ink3: '#5E6A71',
  ink4: '#8A949A',

  line: '#E4E8E9',
  line2: '#EEF1F2',

  brand: '#0F4C5C',
  brandSoft: '#ECF1F2',
  brandLine: '#CFDBDE',
  brandInk: '#0B3D49',

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
