// Grafica de Pareto en SVG (sin librerias, como las demas graficas de VIOS): barras rojas de frecuencia (eje
// izquierdo), linea azul de % acumulado (eje derecho 0-100%) y linea punteada del 80%. Los defectos vitales (hasta
// el primero que alcanza el 80%) van en rojo fuerte; el resto en rojo claro. Tooltip con mouse o toque.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtInt } from '@/lib/utils'
import { PARETO_CUT } from './pareto'

function useWidth(initial = 560) {
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
  if (v <= 4) return 4
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * exp
}

const pct = (v) => `${(v * 100).toFixed(v >= 0.995 || v === 0 ? 0 : 1)}%`

// Parte una etiqueta en 2 lineas de ~maxChars.
function lines(name, maxChars) {
  if (name.length <= maxChars) return [name]
  const words = name.split(' ')
  let a = ''
  let i = 0
  while (i < words.length && `${a} ${words[i]}`.trim().length <= maxChars) a = `${a} ${words[i++]}`.trim()
  if (!a) a = words[i++]
  let b = words.slice(i).join(' ')
  if (b.length > maxChars + 2) b = `${b.slice(0, maxChars)}…`
  return b ? [a, b] : [a]
}

export function ParetoChart({ rows, total, height = 300 }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const n = rows.length
  const pad = { l: 40, r: 44, t: 26, b: 46 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...rows.map((r) => r.n)) * 1.1)
  const slot = iw / Math.max(1, n)
  const bw = Math.max(6, Math.min(40, slot * 0.62))
  const cx = (i) => pad.l + slot * i + slot / 2
  const yL = (v) => pad.t + ih - (v / max) * ih
  const yR = (p) => pad.t + ih - p * ih
  const ticksL = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  const ticksR = [0, 0.2, 0.4, 0.6, 0.8, 1]
  const roomy = slot >= 58 // nombres completos debajo de cada barra
  const showVals = slot >= 22
  const showCum = slot >= 33
  const chars = Math.max(5, Math.floor(slot / 6.2))
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${yR(r.cum).toFixed(1)}`).join(' ')

  const pick = (e) => {
    if (!n) return
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - pad.l) / slot)
    setHover(i >= 0 && i < n ? i : null)
  }
  const h = hover !== null ? rows[hover] : null

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Pareto de defectos: ${rows.map((r) => `${r.name} ${r.n}`).join(', ')}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
        className="block touch-pan-y"
      >
        <defs>
          <linearGradient id="pareto-vital" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {ticksL.map((t) => (
          <g key={`l${t}`}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={yL(t)}
              y2={yL(t)}
              stroke="hsl(var(--border))"
              strokeDasharray={t ? '3 4' : undefined}
            />
            <text
              x={pad.l - 8}
              y={yL(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
              className="tabular"
            >
              {fmtInt(t)}
            </text>
          </g>
        ))}
        {ticksR.map((t) => (
          <text
            key={`r${t}`}
            x={width - pad.r + 8}
            y={yR(t) + 4}
            fontSize="11"
            fill="hsl(var(--muted-foreground))"
            className="tabular"
          >
            {t * 100}%
          </text>
        ))}
        {/* 80% */}
        <line
          x1={pad.l}
          x2={width - pad.r}
          y1={yR(PARETO_CUT)}
          y2={yR(PARETO_CUT)}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text
          x={pad.l + 4}
          y={yR(PARETO_CUT) - 5}
          fontSize="10.5"
          fontWeight="700"
          fill="hsl(var(--muted-foreground))"
        >
          80%
        </text>
        {rows.map((r, i) => {
          const x = cx(i) - bw / 2
          const on = hover === i
          return (
            <g key={r.name}>
              {on && (
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
                x={x}
                y={yL(r.n)}
                width={bw}
                height={Math.max(0, yL(0) - yL(r.n))}
                rx="3"
                fill={r.vital ? 'url(#pareto-vital)' : '#fca5a5'}
                className={r.vital ? '' : 'dark:opacity-70'}
              />
              {(showVals || on) && (
                <text
                  x={cx(i)}
                  y={yL(r.n) - 5}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="800"
                  fill="hsl(var(--foreground))"
                  className="tabular"
                >
                  {fmtInt(r.n)}
                </text>
              )}
              {roomy ? (
                lines(r.name, chars).map((ln, k) => (
                  <text
                    key={ln}
                    x={cx(i)}
                    y={height - pad.b + 16 + k * 12}
                    textAnchor="middle"
                    fontSize="10.5"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {ln}
                  </text>
                ))
              ) : (
                <text
                  x={cx(i)}
                  y={height - pad.b + 16}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="hsl(var(--muted-foreground))"
                >
                  {i + 1}
                </text>
              )}
            </g>
          )
        })}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.25"
            strokeLinejoin="round"
            className="dark:stroke-blue-400"
          />
        )}
        {rows.map((r, i) => (
          <g key={`p${r.name}`}>
            <circle
              cx={cx(i)}
              cy={yR(r.cum)}
              r={hover === i ? 5.5 : 4}
              fill="hsl(var(--card))"
              stroke="#2563eb"
              strokeWidth="2.25"
              className="dark:stroke-blue-400"
            />
            {(showCum || hover === i) && (
              <text
                x={cx(i)}
                y={yR(r.cum) - 9}
                textAnchor="middle"
                fontSize={slot >= 46 ? 10.5 : 9}
                fontWeight="700"
                className="tabular fill-blue-700 dark:fill-blue-300"
              >
                {pct(r.cum)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {!roomy && n > 0 && (
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          {rows.map((r, i) => (
            <span key={r.name} className="mr-2 inline-block">
              <b className="text-foreground">{i + 1}</b> {r.name}
            </span>
          ))}
        </p>
      )}
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-[12px] shadow-md"
          style={{ left: Math.max(80, Math.min(width - 80, cx(hover))) }}
        >
          <div className="text-[13px] font-bold">{h.name}</div>
          <div className="tabular mt-0.5 flex justify-between gap-4">
            <span className="text-muted-foreground">Frecuencia</span>
            <span className="font-bold">
              {fmtInt(h.n)} de {fmtInt(total)}
            </span>
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted-foreground">Individual</span>
            <span className="font-bold">{(h.pct * 100).toFixed(1)}%</span>
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted-foreground">Acumulado</span>
            <span className="font-bold text-blue-700 dark:text-blue-300">{(h.cum * 100).toFixed(1)}%</span>
          </div>
          {h.vital && (
            <div className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
              Dentro del 80% prioritario
            </div>
          )}
        </div>
      )}
    </div>
  )
}
