// Grafica del Centro de desempeno (Reporte del dia): barras azules = Real; linea punteada con puntos = Plan.
//  - Un dia: por hora de cada turno. El plan por hora es el mismo de Hora por Hora (buildSlots: meta del turno
//    repartida en las horas productivas; comida a la mitad, descanso sin plan). Turno sin plan = sin linea.
//  - Varios dias: por fecha de turno, Plan y Real del dia (suma de sus turnos).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'

function useWidth(initial = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.clientWidth || initial)
  }, [initial])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width) || initial))
    ro.observe(el)
    return () => ro.disconnect()
  }, [initial])
  return [ref, width]
}

function niceMax(v) {
  if (v <= 10) return 10
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * exp
}

/**
 * points: [{ key, label, sub?, real, plan (number|null), group? }]
 *   group separa turnos (linea vertical tenue entre grupos y la linea del plan no los une).
 */
export function DesempenoChart({ points, height = 300, className, unit = 'pzs' }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const n = points.length
  const pad = { l: 40, r: 10, t: 16, b: points.some((p) => p.sub) ? 40 : 26 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.real, p.plan || 0))) * 1.1)
  const slot = iw / Math.max(1, n)
  const bw = Math.max(3, Math.min(34, slot * 0.6))
  const cx = (i) => pad.l + slot * i + slot / 2
  const y = (v) => pad.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 46))))

  // Segmentos del plan por grupo (no se une el Turno 1 con el Turno 2).
  const planPaths = useMemo(() => {
    const out = []
    let cur = []
    points.forEach((p, i) => {
      const brk = i > 0 && p.group !== points[i - 1].group
      if (brk || p.plan === null || p.plan === undefined) {
        if (cur.length) out.push(cur)
        cur = []
      }
      if (p.plan !== null && p.plan !== undefined) cur.push(i)
    })
    if (cur.length) out.push(cur)
    return out
  }, [points])

  const pick = (e) => {
    if (!n) return
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - pad.l) / slot)
    setHover(i >= 0 && i < n ? i : null)
  }
  const h = hover !== null ? points[hover] : null

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Producción contra plan"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
        className="block touch-pan-y"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="hsl(var(--border))"
              strokeDasharray={t ? '3 4' : undefined}
            />
            <text
              x={pad.l - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
              className="tabular"
            >
              {fmtInt(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i > 0 && p.group !== points[i - 1].group ? (
            <line
              key={`g${p.key}`}
              x1={pad.l + slot * i}
              x2={pad.l + slot * i}
              y1={pad.t}
              y2={pad.t + ih}
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
          ) : null,
        )}
        {points.map((p, i) => (
          <g key={p.key}>
            {hover === i && (
              <rect
                x={pad.l + slot * i}
                y={pad.t}
                width={slot}
                height={ih}
                fill="hsl(var(--muted))"
                opacity="0.6"
              />
            )}
            <rect
              x={cx(i) - bw / 2}
              y={y(p.real)}
              width={bw}
              height={Math.max(0, y(0) - y(p.real))}
              rx="2.5"
              className="fill-blue-500 dark:fill-blue-400"
            />
            {(i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2)) && (
              <>
                <text
                  x={cx(i)}
                  y={height - (p.sub ? 22 : 8)}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="hsl(var(--muted-foreground))"
                >
                  {p.label}
                </text>
                {p.sub && (
                  <text
                    x={cx(i)}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {p.sub}
                  </text>
                )}
              </>
            )}
          </g>
        ))}
        {planPaths.map((seg) => (
          <path
            key={seg[0]}
            d={seg
              .map((i, k) => `${k ? 'L' : 'M'}${cx(i).toFixed(1)},${y(points[i].plan).toFixed(1)}`)
              .join(' ')}
            fill="none"
            strokeWidth="1.75"
            strokeDasharray="5 4"
            className="stroke-blue-800 dark:stroke-blue-200"
          />
        ))}
        {points.map((p, i) =>
          p.plan !== null && p.plan !== undefined ? (
            <circle
              key={`p${p.key}`}
              cx={cx(i)}
              cy={y(p.plan)}
              r={hover === i ? 4.5 : 3}
              fill="hsl(var(--card))"
              strokeWidth="1.75"
              className="stroke-blue-800 dark:stroke-blue-200"
            />
          ) : null,
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-[12px] shadow-md"
          style={{ left: Math.max(70, Math.min(width - 70, cx(hover))) }}
        >
          <div className="font-semibold text-muted-foreground">{h.title || h.label}</div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted-foreground">Real</span>
            <span className="font-extrabold">
              {fmtInt(h.real)} {unit}
            </span>
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-bold">
              {h.plan === null || h.plan === undefined ? 'sin plan' : `${fmtInt(h.plan)} ${unit}`}
            </span>
          </div>
          {h.note && <div className="mt-0.5 text-[11px] text-muted-foreground">{h.note}</div>}
        </div>
      )}
    </div>
  )
}

export const dayLabel = (d) => fmtYmd(d, { dow: false })
