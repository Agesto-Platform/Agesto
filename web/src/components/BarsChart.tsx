import { useRef, useState, type CSSProperties } from 'react'
import { brl } from './ui/brl'
import { dataCurta, MES_CURTO as MES, SEMANA_CURTA as SEM } from '../lib/format'

export type BarPoint = { data: string; valor: number }

/** Teto "redondo" para a escala (1.000, 2.500, 5.000...). */
function teto(max: number): number {
  if (max <= 0) return 1000
  const p = Math.pow(10, Math.floor(Math.log10(max)))
  for (const k of [1, 2, 2.5, 5, 10]) if (max <= k * p) return k * p
  return 10 * p
}

const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/**
 * Gráfico de barras diário (Receita por dia): leitura direta, altura = dinheiro do dia.
 * A última barra é "hoje" na cor de destaque, com o valor numa pílula.
 * Acima de ~2 meses de pontos, soma por mês para continuar legível.
 */
export function BarsChart({ pontos, label }: { pontos: BarPoint[]; label: string }) {
  const [tip, setTip] = useState<{ i: number; left: number; top: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoje] = useState(() => new Date())

  const porMes = pontos.length > 62
  const serie = porMes ? agruparPorMes(pontos) : pontos.map((p) => ({ d: new Date(p.data), valor: p.valor }))
  const max = teto(Math.max(0, ...serie.map((s) => s.valor)))
  const ultimo = serie.length - 1
  const temHoje = !porMes && ultimo >= 0 && mesmoDia(serie[ultimo]!.d, hoje)
  const passo = Math.max(1, Math.round(serie.length / 6))
  const rotulo = (d: Date) => (porMes ? MES[d.getMonth()]! : dataCurta(d))
  const descricao = (i: number) => {
    const s = serie[i]!
    return (porMes ? MES[s.d.getMonth()] + ' ' + s.d.getFullYear() : SEM[s.d.getDay()] + ' ' + dataCurta(s.d)) + (i === ultimo && temHoje ? ' · hoje' : '')
  }

  const mostrar = (i: number, el: HTMLElement) => {
    const wr = wrapRef.current?.getBoundingClientRect()
    const bar = el.firstElementChild?.getBoundingClientRect()
    if (!wr || !bar) return
    const br = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(br.left - wr.left + br.width / 2 - 75, wr.width - 160))
    setTip({ i, left: x, top: Math.max(-8, bar.top - wr.top - 58) })
  }

  return (
    <div className="bars-chart" role="group" aria-label={label} ref={wrapRef}>
      <div className="bars-grid" aria-hidden="true">
        {[0, 0.5, 1].map((k) => (
          <span key={k} style={{ bottom: k * 100 + '%' }}>
            <em>{brl(k * max)}</em>
          </span>
        ))}
      </div>
      <div className="bars-plot animate">
        {serie.map((s, i) => {
          const h = Math.max(0, Math.min(100, (s.valor / max) * 100))
          const today = i === ultimo && temHoje
          const cls = ['bcol', !s.valor && 'zero', today && 'today'].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              className={cls}
              style={{ '--h': h + '%', '--d': i * 16 } as CSSProperties}
              data-label={today ? 'Hoje · ' + brl(s.valor) : undefined}
              aria-label={descricao(i) + ': ' + (s.valor ? brl(s.valor) : 'sem faturamento')}
              onMouseEnter={(e) => mostrar(i, e.currentTarget)}
              onFocus={(e) => mostrar(i, e.currentTarget)}
              onMouseLeave={() => setTip(null)}
              onBlur={() => setTip(null)}
            >
              <i />
            </button>
          )
        })}
      </div>
      <div className="bars-x" aria-hidden="true">
        {serie.map((s, i) => (
          <span key={i}>{(i % passo === 0 && i < ultimo - 2) || i === ultimo ? rotulo(s.d) : ''}</span>
        ))}
      </div>
      <div className={`tip${tip ? ' show' : ''}`} role="status" style={tip ? { left: tip.left, top: tip.top } : undefined}>
        {tip && (
          <>
            <span>{descricao(tip.i)}</span>
            <b>{serie[tip.i]!.valor ? brl(serie[tip.i]!.valor) : 'Sem faturamento'}</b>
          </>
        )}
      </div>
    </div>
  )
}

function agruparPorMes(pontos: BarPoint[]): { d: Date; valor: number }[] {
  const meses = new Map<string, { d: Date; valor: number }>()
  for (const p of pontos) {
    const d = new Date(p.data)
    const k = d.getFullYear() + '-' + d.getMonth()
    const m = meses.get(k) ?? { d: new Date(d.getFullYear(), d.getMonth(), 1), valor: 0 }
    m.valor += p.valor
    meses.set(k, m)
  }
  return [...meses.values()]
}
