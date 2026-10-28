const SEM_ACENTO: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

/** Minúsculas e sem acento: "Higienização" e "higienizacao" se encontram. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => SEM_ACENTO[c] ?? c)
}

/**
 * true quando cada palavra da busca aparece em algum dos textos (em qualquer
 * ordem). Um número compara só os dígitos, para "99999" achar "(11) 99999-0000".
 * Busca vazia combina com tudo.
 */
export function combinaBusca(busca: string, ...textos: (string | null | undefined)[]): boolean {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return true
  const presentes = textos.filter((t): t is string => !!t)
  const alvo = normalizar(presentes.join(' '))
  return palavras.every((p) => {
    if (alvo.includes(p)) return true
    const digitos = p.replace(/\D/g, '')
    return /^[\d.\-/()]+$/.test(p) && digitos.length > 0 && presentes.some((t) => t.replace(/\D/g, '').includes(digitos))
  })
}
