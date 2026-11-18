/** Formatos de data e nome usados nas telas (pt-BR, igual aos templates). */
export const MES_CURTO = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
export const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const SEMANA_CURTA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']
export const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * Converte para Date. Um dia puro ("2026-11-17", como a API manda a receita por dia)
 * vira meia-noite local: `new Date('2026-11-17')` seria UTC e cairia no dia anterior no Brasil.
 */
export function paraData(d: Date | string): Date {
  if (typeof d !== 'string') return d
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  return dia ? new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])) : new Date(d)
}

const toDate = paraData

/** "20 out." */
export function dataCurta(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const x = toDate(d)
  return String(x.getDate()).padStart(2, '0') + ' ' + MES_CURTO[x.getMonth()]
}

/** "qui. · 11:00" */
export function semanaHora(d: Date | string): string {
  const x = toDate(d)
  return SEMANA_CURTA[x.getDay()] + ' · ' + hora(x)
}

/** "11:00" */
export function hora(d: Date | string): string {
  const x = toDate(d)
  return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0')
}

/** "Outubro" */
export function mesNome(d: Date = new Date()): string {
  const m = MES_LONGO[d.getMonth()]!
  return m[0]!.toUpperCase() + m.slice(1)
}

/** "Terça, 20 de outubro" */
export function hojeExtenso(d: Date = new Date()): string {
  return `${SEMANA_LONGA[d.getDay()]}, ${d.getDate()} de ${MES_LONGO[d.getMonth()]}`
}

/** Iniciais para o avatar: "Vó Joana" -> "VJ". */
export function iniciais(nome: string): string {
  const palavras = nome.split(/\s+/).filter((w) => /^[A-ZÀ-Ú]/.test(w))
  return (palavras.length ? palavras : nome.split(/\s+/))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}
