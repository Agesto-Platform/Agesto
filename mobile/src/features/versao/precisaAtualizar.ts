/** "1.2.3" em números; null se algum pedaço não for número. */
function partes(versao: string): number[] | null {
  const p = versao.trim().split('.')
  return p.every((n) => /^\d+$/.test(n)) ? p.map(Number) : null
}

/**
 * true quando o APK instalado está abaixo da versão mínima que a API pede.
 * Sem versão instalada (Expo Go, dev) ou sem mínima configurada, não avisa;
 * versão fora do formato 1.2.3 também não, para nunca avisar por engano.
 */
export function precisaAtualizar(instalada: string | null | undefined, minima: string | null | undefined): boolean {
  if (!instalada || !minima) return false
  const a = partes(instalada)
  const b = partes(minima)
  if (!a || !b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}
