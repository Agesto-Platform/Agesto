/**
 * Símbolo do Agesto (conceito "C · Bloco"): um bloco de lado arredondado com o
 * círculo de destaque encaixado; ele é o "a" de "agesto". O bloco usa a cor do
 * texto da paleta e o círculo a cor de destaque, então acompanha paleta e modo.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo${className ? ' ' + className : ''}`} viewBox="18 16 86 88" aria-hidden="true">
      <path d="M62 16H104V104H62A44 44 0 0 1 62 16Z" fill="currentColor" />
      <circle cx="58" cy="60" r="17" fill="var(--accent)" />
    </svg>
  )
}
