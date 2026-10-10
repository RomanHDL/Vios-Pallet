// Graficas de Personal y productividad (SVG, sin librerias): minigrafica, tendencia de doble eje y dona.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn, fmtInt } from '@/lib/utils'

function useWidth(initial = 600) {
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

// Curva suave (Catmull-Rom -> Bezier) por los puntos [[x, y]].
export function smoothPath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    // Los puntos de control no salen del rango vertical del tramo: la curva no inventa picos ni baja de cero.
    const lo = Math.min(p1[1], p2[1])
    const hi = Math.max(p1[1], p2[1])
    const cl = (v) => Math.min(hi, Math.max(lo, v))
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6)]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6)]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function niceMax(v) {
  if (v <= 5) return 5
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * exp
}

// Minigrafica: necesita al menos 2 valores reales; si no, no dibuja nada.
export function Sparkline({ values, color, id, className }) {
  if (!values || values.length < 2) return null
  const w = 120
  const h = 44
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i * w) / (values.length - 1), h - 4 - ((v - min) / span) * (h - 10)])
  const line = smoothPath(pts)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-11 w-[120px]', className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Tendencia de doble eje. points: [{ key, label, title?, a, b }]
 *  a = piezas producidas (eje izquierdo, azul), b = piezas por persona (eje derecho, violeta; null = sin dato).
 */
export function TrendDual({
  points,
  height = 330,
  aLabel = 'Piezas producidas',
  bLabel = 'Piezas por persona',
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const n = points.length
  const pad = { l: 56, r: 56, t: 22, b: 30 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const maxA = niceMax(Math.max(1, ...points.map((p) => p.a)) * 1.12)
  const maxB = niceMax(Math.max(1, ...points.map((p) => p.b || 0)) * 1.12)
  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1))
  const yA = (v) => pad.t + ih - (v / maxA) * ih
  const yB = (v) => pad.t + ih - (v / maxB) * ih
  const ptsA = points.map((p, i) => [x(i), yA(p.a)])
  const bIdx = points.map((p, i) => (p.b === null || p.b === undefined ? null : i)).filter((i) => i !== null)
  const ptsB = bIdx.map((i) => [x(i), yB(points[i].b)])
  const lineA = smoothPath(ptsA)
  const lineB = smoothPath(ptsB)
  const base = pad.t + ih
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 58))))
  const lastA = n - 1
  const lastB = bIdx.at(-1)
  const pick = (e) => {
    if (!n) return
    const rect = e.currentTarget.getBoundingClientRect()
    const i = n <= 1 ? 0 : Math.round(((e.clientX - rect.left - pad.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const h = hover !== null ? points[hover] : null
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1]
  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Tendencia de producción"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
        className="block touch-pan-y"
      >
        <defs>
          <linearGradient id="pp-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pp-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={pad.t + ih - t * ih}
              y2={pad.t + ih - t * ih}
              stroke="hsl(var(--border))"
              strokeDasharray={t ? '3 4' : undefined}
            />
            <text
              x={pad.l - 8}
              y={pad.t + ih - t * ih + 4}
              textAnchor="end"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
              className="tabular"
            >
              {fmtInt(maxA * t)}
            </text>
            <text
              x={width - pad.r + 8}
              y={pad.t + ih - t * ih + 4}
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
              className="tabular"
            >
              {fmtInt(maxB * t)}
            </text>
          </g>
        ))}
        <text
          transform={`translate(14 ${pad.t + ih / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11"
          fill="hsl(var(--muted-foreground))"
        >
          {aLabel}
        </text>
        <text
          transform={`translate(${width - 10} ${pad.t + ih / 2}) rotate(90)`}
          textAnchor="middle"
          fontSize="11"
          fill="hsl(var(--muted-foreground))"
        >
          {bLabel}
        </text>
        {points.map((p, i) =>
          i % every === 0 || i === n - 1 ? (
            <text
              key={p.key}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
            >
              {p.label}
            </text>
          ) : null,
        )}
        {ptsA.length > 1 && <path d={`${lineA} L${x(n - 1)},${base} L${x(0)},${base} Z`} fill="url(#pp-a)" />}
        {ptsB.length > 1 && (
          <path d={`${lineB} L${ptsB.at(-1)[0]},${base} L${ptsB[0][0]},${base} Z`} fill="url(#pp-b)" />
        )}
        <path
          d={lineA}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.75"
          strokeLinecap="round"
          className="dark:stroke-blue-400"
        />
        <path
          d={lineB}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="dark:stroke-violet-400"
        />
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={base}
            stroke="hsl(var(--muted-foreground))"
            strokeOpacity="0.35"
          />
        )}
        {n > 0 && (
          <line
            x1={x(lastA)}
            x2={x(lastA)}
            y1={yA(points[lastA].a)}
            y2={base}
            stroke="#2563eb"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />
        )}
        {ptsA.map(([px, py], i) => (
          <circle
            key={`a${points[i].key}`}
            cx={px}
            cy={py}
            r={i === hover || i === lastA ? 5 : 3.5}
            fill="hsl(var(--card))"
            stroke="#2563eb"
            strokeWidth="2"
            className="dark:stroke-blue-400"
          />
        ))}
        {ptsB.map(([px, py], k) => (
          <circle
            key={`b${points[bIdx[k]].key}`}
            cx={px}
            cy={py}
            r={bIdx[k] === hover || bIdx[k] === lastB ? 5 : 3.5}
            fill="hsl(var(--card))"
            stroke="#7c3aed"
            strokeWidth="2"
            className="dark:stroke-violet-400"
          />
        ))}
        {n > 0 && (
          <g>
            <rect
              x={Math.min(width - pad.r - 44, x(lastA) - 22)}
              y={yA(points[lastA].a) - 32}
              width="44"
              height="22"
              rx="6"
              fill="#2563eb"
            />
            <text
              x={Math.min(width - pad.r - 22, x(lastA))}
              y={yA(points[lastA].a) - 17}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#fff"
              className="tabular"
            >
              {fmtInt(points[lastA].a)}
            </text>
          </g>
        )}
        {lastB !== undefined && (
          <g>
            <rect
              x={Math.min(width - pad.r - 44, x(lastB) - 22) - 26}
              y={yB(points[lastB].b) + 8}
              width="44"
              height="22"
              rx="6"
              fill="#7c3aed"
            />
            <text
              x={Math.min(width - pad.r - 22, x(lastB)) - 26}
              y={yB(points[lastB].b) + 23}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#fff"
              className="tabular"
            >
              {fmtInt(points[lastB].b)}
            </text>
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-[12px] shadow-md"
          style={{ left: Math.max(80, Math.min(width - 80, x(hover))) }}
        >
          <div className="font-semibold text-muted-foreground">{h.title || h.label}</div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-blue-600 dark:text-blue-400">{aLabel}</span>
            <span className="font-extrabold">{fmtInt(h.a)}</span>
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-violet-600 dark:text-violet-400">{bLabel}</span>
            <span className="font-extrabold">
              {h.b === null || h.b === undefined
                ? 'sin personas'
                : h.b.toLocaleString('es-MX', { maximumFractionDigits: 1 })}
            </span>
          </div>
          {h.note && <div className="mt-0.5 text-[11px] text-muted-foreground">{h.note}</div>}
        </div>
      )}
    </div>
  )
}

// Dona: parts [{ key, value, color }]; el centro muestra total y su unidad.
export function Donut({ parts, total, unit, size = 168 }) {
  const r = 62
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="22" className="stroke-muted" />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c
            const el = (
              <circle
                key={p.key}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                strokeWidth="22"
                stroke={p.color}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-acc}
                style={{ transition: 'stroke-dasharray .5s ease' }}
              />
            )
            acc += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="tabular text-[26px] font-extrabold leading-none">{fmtInt(total)}</span>
        <span className="mt-1 max-w-[96px] text-[11.5px] leading-tight text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}
