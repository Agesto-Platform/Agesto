/**
 * Textos dos termos de uso e da política de privacidade (B6), publicados em
 * /termos e /privacidade. São esses os links de Termos__UrlTermos e
 * Termos__UrlPrivacidade no Render.
 *
 * Para publicar ou mudar um texto: troque as seções e a data aqui, publique o
 * web e só então suba Termos__Versao no Render, que pede o aceite de novo a todos.
 * Sem seções, a página avisa que o texto ainda está em revisão.
 */
export interface Secao {
  titulo: string
  paragrafos: string[]
}

export interface DocumentoLegal {
  titulo: string
  /** Data da versão publicada, como o leitor deve ver (ex.: "1º de novembro de 2026"). */
  atualizadoEm: string | null
  secoes: Secao[]
}

export const TERMOS: DocumentoLegal = {
  titulo: 'Termos de uso',
  atualizadoEm: null,
  secoes: [],
}

export const PRIVACIDADE: DocumentoLegal = {
  titulo: 'Política de privacidade',
  atualizadoEm: null,
  secoes: [],
}
