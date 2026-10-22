import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'

/**
 * Mascote do Agente (feito em código, como nos templates): corpo com o gradiente
 * da paleta e olhos em pílula que piscam, olham para o cursor e mudam de expressão.
 */
export type Face = 'idle' | 'blink' | 'happy' | 'wink' | 'dot' | 'shy' | 'surprised'

export interface MascoteApi {
  /** Troca a expressão; com `ms`, volta ao normal depois desse tempo. */
  face: (f: Face, ms?: number) => MascoteApi
  /** Trava o olhar num ponto da tela. */
  lookAt: (x: number, y: number) => MascoteApi
  /** Libera o olhar (volta a seguir o cursor). */
  free: () => MascoteApi
  /** Pulinho com achatamento. */
  hop: () => MascoteApi
  /** Fala no balão (precisa de `bubble`) com anéis de onda. */
  say: (content: ReactNode, ms?: number) => MascoteApi
}

// último ponto do cursor, compartilhado por todos os mascotes da tela
let lastPointer = { x: -1, y: -1, t: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() }
    },
    { passive: true },
  )
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Eye({ side }: { side: 'l' | 'r' }) {
  return (
    <i className={`eye ${side}`}>
      <b className="pill" />
      <svg className="arc" viewBox="0 0 12 7" aria-hidden="true">
        <path d="M1.6 6 Q6 -0.6 10.4 6" />
      </svg>
    </i>
  )
}

export function Mascote({
  bubble = false,
  ref,
}: {
  bubble?: boolean
  ref?: Ref<MascoteApi>
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const eyesRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLSpanElement>(null)
  const ringsRef = useRef<HTMLSpanElement[]>([])
  const [bubbleContent, setBubbleContent] = useState<ReactNode>(null)
  const [bubbleShow, setBubbleShow] = useState(false)
  const state = useRef({ holdT: 0, bubbleT: 0, locked: null as { x: number; y: number } | null })

  // a expressão vive no atributo (como no template), sem re-render a cada piscada
  const setFace = (f: Face) => {
    if (rootRef.current) rootRef.current.dataset.face = f
  }
  const getFace = () => (rootRef.current?.dataset.face ?? 'idle') as Face

  useImperativeHandle(ref, () => {
    const api: MascoteApi = {
      face(f, ms) {
        clearTimeout(state.current.holdT)
        setFace(f)
        if (ms) state.current.holdT = window.setTimeout(() => setFace('idle'), ms)
        return api
      },
      lookAt(x, y) {
        state.current.locked = { x, y }
        return api
      },
      free() {
        state.current.locked = null
        return api
      },
      hop() {
        if (reduced() || !bodyRef.current) return api
        bodyRef.current.animate(
          [
            { transform: 'none' },
            { transform: 'scale(1.08, 0.9)', offset: 0.18 },
            { transform: 'translateY(-14%) scale(0.95, 1.06)', offset: 0.5 },
            { transform: 'scale(1.05, 0.95)', offset: 0.82 },
            { transform: 'none' },
          ],
          { duration: 560, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
        )
        return api
      },
      say(content, ms = 2800) {
        api.face('happy', Math.min(ms, 1600))
        if (!reduced())
          ringsRef.current.forEach((r, i) =>
            r.animate(
              [
                { opacity: 0.6, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(1.9)' },
              ],
              { duration: 1100, delay: i * 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
            ),
          )
        if (bubble) {
          setBubbleContent(content)
          setBubbleShow(true)
          clearTimeout(state.current.bubbleT)
          state.current.bubbleT = window.setTimeout(() => setBubbleShow(false), ms)
        }
        return api
      },
    }
    return api
  }, [bubble])

  useEffect(() => {
    const m = rootRef.current
    const eyes = eyesRef.current
    if (!m || !eyes) return
    let alive = true
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))

    // piscar: intervalo irregular, às vezes duas seguidas
    const blinkLoop = () =>
      later(() => {
        if (!alive) return
        if (getFace() === 'idle') {
          setFace('blink')
          later(() => getFace() === 'blink' && setFace('idle'), 120)
          if (Math.random() < 0.25)
            later(() => {
              if (getFace() !== 'idle') return
              setFace('blink')
              later(() => getFace() === 'blink' && setFace('idle'), 110)
            }, 260)
        }
        blinkLoop()
      }, 2200 + Math.random() * 3400)
    blinkLoop()

    // olhar: segue o cursor; parado, dá olhadas aleatórias
    let lx = 0, ly = 0, tx = 0, ty = 0, glanceAt = 0, raf = 0
    const gaze = (now: number) => {
      if (!alive) return
      const r = m.getBoundingClientRect()
      if (r.width) {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        const p = state.current.locked ?? (now - lastPointer.t < 2600 && lastPointer.x >= 0 ? lastPointer : null)
        if (p) {
          const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220)
          tx = (dx / d) * 9 * k
          ty = (dy / d) * 7 * k
        } else if (now > glanceAt) {
          const a = Math.random() * Math.PI * 2, s = Math.random() < 0.35 ? 0 : 0.5 + Math.random() * 0.5
          tx = Math.cos(a) * 8 * s
          ty = Math.sin(a) * 5 * s
          glanceAt = now + 1400 + Math.random() * 2600
        }
        lx += (tx - lx) * 0.18
        ly += (ty - ly) * 0.18
        eyes.style.transform = `translate(${lx.toFixed(2)}%,${ly.toFixed(2)}%)`
      }
      raf = requestAnimationFrame(gaze)
    }
    raf = requestAnimationFrame(gaze)

    const s = state.current
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      clearTimeout(s.holdT)
      clearTimeout(s.bubbleT)
    }
  }, [])

  return (
    <div className="masc" data-face="idle" ref={rootRef}>
      <span className="masc-glow" />
      <span className="masc-ring" ref={(el) => { if (el) ringsRef.current[0] = el }} />
      <span className="masc-ring" ref={(el) => { if (el) ringsRef.current[1] = el }} />
      <span className="masc-float">
        <span className="masc-body" ref={bodyRef}>
          <span className="masc-shine" />
          <span className="blush l" />
          <span className="blush r" />
          <span className="masc-eyes" ref={eyesRef}>
            <Eye side="l" />
            <Eye side="r" />
          </span>
        </span>
      </span>
      {bubble && (
        <span className={`masc-bubble${bubbleShow ? ' show' : ''}`} role="status">
          {bubbleContent}
        </span>
      )}
    </div>
  )
}
