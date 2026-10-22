import type { MascoteApi } from '../components/Mascote'
import { brl } from '../components/ui/brl'

/**
 * Abertura pós-login (só na Visão geral, vinda do Login). Porte do template.
 * Um relógio-mestre conduz tudo: o mascote nasce no centro e "respira" -> os cards
 * nascem dele em onda (mais perto primeiro) -> números e gráficos começam quando o
 * card deles aparece -> o mascote voa em arco até o painel do Agente e passa a vez
 * para o mascote de lá. Pular = avanço rápido (7x), nunca corte seco.
 */

/** Transição do Login guardada para a Visão geral continuar o movimento. */
let pendente: ViewTransition | null = null
export function guardarTransicao(vt: ViewTransition | null): void {
  pendente = vt
}
export function pegarTransicao(): ViewTransition | null {
  const vt = pendente
  pendente = null
  return vt
}

/**
 * Põe o mascote da abertura no centro da área de conteúdo. Chamado já no
 * primeiro quadro da Visão geral, para a transição do login pousar nele.
 */
export function posicionarOverlay(overlay: HTMLElement): { cx: number; cy: number } {
  const m = document.querySelector('.main')?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight)
  const cx = m.left + m.width / 2, cy = m.top + m.height * 0.4
  overlay.style.left = cx - 44 + 'px'
  overlay.style.top = cy - 44 + 'px'
  overlay.style.visibility = 'visible'
  return { cx, cy }
}

export function entradaReduzida(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)' // entradas
const INOUT = 'cubic-bezier(0.77, 0, 0.175, 1)' // movimento na tela (eixo X do voo)
const ARC = 'cubic-bezier(0.33, 0, 0.15, 1)' // eixo Y do voo: sobe cedo, pousa macio
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

type Trigger = { at: number; run?: () => void; fired?: boolean; count?: HTMLElement; to?: number }

export function runEntrada({
  vt,
  overlay,
  mascote,
  painelMascote,
  onDone,
}: {
  vt: ViewTransition | null
  /** `.entrada-orb` já renderizado (fly > ring + orb, texto, dica de pular). */
  overlay: HTMLElement
  mascote: MascoteApi | null
  painelMascote: () => MascoteApi | null
  onDone: () => void
}): () => void {
  const root = document.documentElement
  const fly = overlay.querySelector<HTMLElement>('.entrada-fly')
  const orb = overlay.querySelector<HTMLElement>('.orb')
  const ring = overlay.querySelector<HTMLElement>('.ring')
  const txt = overlay.querySelector<HTMLElement>('.entrada-txt')
  const skip = overlay.querySelector<HTMLElement>('.entrada-skip')
  if (!fly || !orb || !ring || !txt || !skip) {
    root.classList.remove('entrada')
    onDone()
    return () => {}
  }

  const anims: Animation[] = []
  const add = (el: Element, kf: Keyframe[], opt: KeyframeAnimationOptions) => {
    const a = el.animate(kf, { fill: 'backwards', ...opt })
    anims.push(a)
    return a
  }

  // gráficos em espera até o card deles aparecer (sem "pulo")
  document.querySelectorAll('#page .bars-plot.animate, #page .track.animate').forEach((c) => {
    c.classList.remove('animate')
    c.classList.add('pre')
  })

  // ---- mascote no centro da área de conteúdo
  const S = 88
  const { cx, cy } = posicionarOverlay(overlay)

  // vindo do login com transição, o mascote já chega voando (mesmo nome: agente); senão, surge no centro
  if (!vt)
    add(orb, [{ opacity: 0, transform: 'scale(0.92)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
      duration: 520,
      easing: OUT,
      fill: 'both',
    })
  const breathe = orb.animate([{ scale: '1' }, { scale: '1.035' }, { scale: '1' }], {
    duration: 1400,
    delay: 520,
    iterations: Infinity,
    easing: 'ease-in-out',
  })
  add(ring, [{ opacity: 0.45, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.7)' }], { duration: 900, delay: 300, easing: OUT, fill: 'both' })
  add(txt, [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
    duration: 360,
    delay: 110,
    easing: OUT,
    fill: 'both',
  })
  add(skip, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 280, easing: OUT, fill: 'both' })
  // a saudação sai antes de os cards chegarem ao centro (texto nunca sobre texto)
  add(txt, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-4px)', filter: 'blur(2px)' }], { duration: 180, delay: 520, easing: OUT, fill: 'forwards' })
  add(skip, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, delay: 520, fill: 'forwards' })

  // ---- cards nascem do mascote, em onda (mais perto primeiro)
  const blocks = [...document.querySelectorAll<HTMLElement>('#page .page-head, #page .card')]
    .map((el) => {
      const r = el.getBoundingClientRect()
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2
      return { el, r, d: Math.hypot(ex - cx, ey - cy), vx: cx - ex, vy: cy - ey }
    })
    .sort((a, b) => a.d - b.d)
  const triggers: Trigger[] = []
  let lastIn = 0
  blocks.forEach((b, i) => {
    const delay = 460 + i * 40
    lastIn = delay + 480
    const ox = clamp(((cx - b.r.left) / b.r.width) * 100, 0, 100), oy = clamp(((cy - b.r.top) / b.r.height) * 100, 0, 100)
    const tx = clamp(b.vx * 0.06, -24, 24), ty = clamp(b.vy * 0.06, -24, 24)
    b.el.style.transformOrigin = ox + '% ' + oy + '%'
    b.el.style.willChange = 'transform, opacity, filter'
    add(
      b.el,
      [
        { opacity: 0, transform: `translate(${tx}px,${ty}px) scale(0.97)`, filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration: 480, delay, easing: OUT },
    )
    b.el.querySelectorAll('.pre').forEach((c) =>
      triggers.push({
        at: delay + 200,
        run: () => {
          c.classList.remove('pre')
          c.classList.add('animate')
        },
      }),
    )
    b.el.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => triggers.push({ at: delay + 120, count: n, to: +(n.dataset.count ?? 0) }))
  })
  const fmt = (n: HTMLElement, v: number) => (n.dataset.fmt === 'brl' ? brl(v) : String(v))
  triggers.forEach((t) => t.count && (t.count.textContent = fmt(t.count, 0)))
  root.classList.remove('entrada')

  // ---- voo em arco até o Agente (X e Y com curvas diferentes = arco)
  const shell = document.querySelector<HTMLElement>('.shell')
  const agentOpen = shell?.dataset.agent !== 'closed' && !window.matchMedia('(max-width: 1279px)').matches
  const agentOrb = document.querySelector<HTMLElement>('.agent .orb')
  const target = (agentOpen && agentOrb) || document.querySelector<HTMLElement>('[data-agent-toggle]')
  const t = target?.getBoundingClientRect() ?? new DOMRect(cx, cy, 0, 0)
  const dx = t.left + t.width / 2 - cx, dy = t.top + t.height / 2 - cy
  const sc = agentOpen ? t.width / S : 0.35
  const flyAt = Math.max(1050, lastIn - 260), FLY = 560, land = flyAt + FLY
  triggers.push({ at: flyAt - 140, run: () => breathe.cancel() })
  add(orb, [{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: `scale(${sc})` }], {
    duration: FLY + 140,
    delay: flyAt - 140,
    easing: 'ease-in-out',
    fill: 'forwards',
  })
  add(overlay, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: FLY, delay: flyAt, easing: INOUT, fill: 'forwards' })
  add(fly, [{ transform: 'translateY(0)' }, { transform: `translateY(${dy}px)` }], { duration: FLY, delay: flyAt, easing: ARC, fill: 'forwards' })
  if (!agentOpen) add(fly, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: land - 200, fill: 'forwards' })

  // ---- pouso: o mascote do painel assume e assenta; o resto do painel aparece
  const agentBits = [...document.querySelectorAll<HTMLElement>('.agent-body > *, .composer')]
  agentBits.forEach((el, i) => {
    if (el === agentOrb)
      add(
        el,
        [
          { opacity: 0, transform: 'scale(1.08)' },
          { opacity: 1, transform: 'scale(1.08)', offset: 0.25 },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 480, delay: land - 60, easing: OUT },
      )
    else add(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: land + 60 + i * 45, easing: OUT })
  })
  triggers.push({ at: land, run: () => (overlay.style.visibility = 'hidden') })
  // expressões: sorri ao cumprimentar, foca no voo, pisca ao pousar
  triggers.push({ at: 100, run: () => mascote?.face('happy') })
  triggers.push({ at: 580, run: () => mascote?.face('idle') })
  triggers.push({ at: flyAt - 120, run: () => mascote?.face('dot') })
  triggers.push({ at: land + 40, run: () => painelMascote()?.face('wink', 700).hop() })
  const END = land + 60 + agentBits.length * 45 + 400

  // ---- relógio-mestre: dita contagem e gatilhos; respeita o avanço rápido
  const master = document.body.animate([{ opacity: 1 }, { opacity: 1 }], { duration: END })
  anims.push(master)
  let done = false
  let raf = 0
  const tick = () => {
    if (done) return
    const now = Number(master.currentTime ?? END)
    triggers.forEach((tg) => {
      if (tg.run && !tg.fired && now >= tg.at) {
        tg.fired = true
        tg.run()
      }
      if (tg.count) {
        const p = clamp((now - tg.at) / 700, 0, 1)
        tg.count.textContent = fmt(tg.count, Math.round((tg.to ?? 0) * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p))))
      }
    })
    if (now < END) raf = requestAnimationFrame(tick)
    else finish()
  }
  raf = requestAnimationFrame(tick)

  const SKIP_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
  function finish() {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    anims.forEach((a) => a.finish())
    breathe.cancel()
    triggers.forEach((tg) => {
      if (tg.run && !tg.fired) tg.run()
      if (tg.count) tg.count.textContent = fmt(tg.count, tg.to ?? 0)
    })
    blocks.forEach((b) => {
      b.el.style.willChange = ''
      b.el.style.transformOrigin = ''
    })
    SKIP_EVENTS.forEach((ev) => window.removeEventListener(ev, fastForward, true))
    onDone()
  }
  // pular: avanço rápido até o fim (sai em ~300ms, sem solavanco)
  function fastForward() {
    if (done) return
    vt?.skipTransition()
    anims.forEach((a) => a.updatePlaybackRate(7))
    breathe.cancel()
  }
  SKIP_EVENTS.forEach((ev) => window.addEventListener(ev, fastForward, { capture: true, once: true }))

  // sincronia com a transição do login: a abertura espera o cartão virar painel
  if (vt) {
    root.dataset.vt = 'entrada'
    anims.forEach((a) => a.pause())
    breathe.pause()
    vt.finished.finally(() => {
      delete root.dataset.vt
      orb.style.viewTransitionName = ''
      if (done) return
      anims.forEach((a) => a.play())
      breathe.play()
    })
  }

  return finish
}
