import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// painéis abertos, do mais antigo ao mais novo: só o de cima responde ao Esc e ao Tab
const pilha: symbol[] = []

/**
 * Enquanto `active`: leva o foco para dentro do painel, prende o Tab nele,
 * fecha no Esc e devolve o foco para quem abriu quando fechar.
 * Com painéis empilhados (diálogo sobre gaveta), só o de cima reage.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void): void {
  // a função de fechar pode mudar a cada render sem reiniciar o foco
  const fechar = useRef(onClose)
  useEffect(() => {
    fechar.current = onClose
  })

  useEffect(() => {
    if (!active) return
    const box = ref.current
    if (!box) return
    const id = Symbol('trap')
    pilha.push(id)
    const opener = document.activeElement as HTMLElement | null
    const first = box.querySelector<HTMLElement>('[data-autofocus]') ?? box.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        fechar.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const a = items[0]!, z = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault()
        z.focus()
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault()
        a.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      pilha.splice(pilha.indexOf(id), 1)
      opener?.focus?.({ preventScroll: true })
    }
  }, [active, ref])
}
