// Paleta, modo e sidebar antes do primeiro quadro (sem piscar a tela errada).
// Arquivo à parte porque a CSP (public/_headers) não aceita script inline.
try {
  var d = document.documentElement, ls = localStorage
  var p = ls.getItem('agesto-palette')
  d.dataset.palette = p === 'oceano' ? 'oceano' : 'marinho'
  var m = ls.getItem('agesto-mode')
  d.dataset.mode = m === 'dark' || m === 'light' ? m : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  d.dataset.sb = innerWidth >= 1024 ? ls.getItem('agesto-sb') || 'open' : 'open'
} catch (e) {
  /* armazenamento indisponível: fica o padrão (Marinho, claro) */
}
