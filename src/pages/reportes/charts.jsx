// Graficas hechas a mano en SVG (sin librerias). Se dibujan al ancho real del contenedor
// para que el texto se lea igual en celular y en PC.
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
  if (v <= 0) return 10
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * exp
}

const shortDate = (ymd) => fmtYmd(ymd, { dow: false })

/**
 * Linea + area de totales diarios con proyeccion punteada y marca de HOY.
 *  points:     [{ date, value }]  (dias reales)
 *  projection: [{ date, value }]  (dias futuros estimados)
 *  reference:  { value, label }   (linea horizontal, ej. capacidad)
 */
export function TrendChart({
  points,
  projection = [],
  showProjection = true,
  today,
  reference,
  height = 260,
  className,
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const proj = showProjection ? projection : []
  const all = useMemo(
    () => [...points.map((p) => ({ ...p, kind: 'real' })), ...proj.map((p) => ({ ...p, kind: 'proj' }))],
    [points, proj],
  )

  // Con desglose por punto (p.parts = [{ label, n }]) se deja lugar arriba para las etiquetas de cada dia.
  const maxParts = Math.max(0, ...points.map((p) => p.parts?.length || 0))
  const labeled = points.some((p) => p.parts)
  const pad = { l: 44, r: 14, t: labeled ? 30 + maxParts * 12 : 18, b: 30 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const n = all.length
  const max = niceMax(Math.max(1, ...all.map((p) => p.value), reference?.value || 0) * 1.05)
  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1))
  const y = (v) => pad.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))

  const real = all.filter((p) => p.kind === 'real')
  const linePath = real.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const areaPath = real.length
    ? `${linePath} L${x(real.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
    : ''
  const projStart = real.length ? real.length - 1 : 0
  const projPath = proj.length
    ? all
        .slice(projStart)
        .map((p, k) => `${k ? 'L' : 'M'}${x(projStart + k).toFixed(1)},${y(p.value).toFixed(1)}`)
        .join(' ')
    : ''

  // Marca HOY: en el dia de hoy si hay datos, si no entre el ultimo real y la proyeccion.
  let hoyX = null
  const todayIdx = all.findIndex((p) => p.date === today)
  if (todayIdx >= 0) hoyX = x(todayIdx)
  else if (proj.length && real.length) hoyX = (x(real.length - 1) + x(real.length)) / 2

  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))))
  const onMove = (e) => {
    if (!n) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = n <= 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const h = hover !== null ? all[hover] : null

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Producción diaria"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-pan-y"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
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
        {reference?.value > 0 && (
          <g>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={width - pad.r}
              y={y(reference.value) - 5}
              textAnchor="end"
              fontSize="11"
              fontWeight="600"
              fill="#059669"
            >
              {reference.label} {fmtInt(reference.value)}
            </text>
          </g>
        )}
        {all.map((p, i) =>
          i % every === 0 || i === n - 1 ? (
            <text
              key={p.date}
              x={x(i)}
              y={height - 9}
              textAnchor="middle"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
            >
              {shortDate(p.date)}
            </text>
          ) : null,
        )}
        {areaPath && <path d={areaPath} fill="url(#trend-fill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {projPath && (
          <path
            d={projPath}
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}
        {hoyX !== null && (
          <g>
            <line
              x1={hoyX}
              x2={hoyX}
              y1={pad.t - 4}
              y2={pad.t + ih}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
            <rect x={hoyX - 18} y={pad.t - 16} width="36" height="16" rx="8" fill="#ef4444" />
            <text x={hoyX} y={pad.t - 4.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
              HOY
            </text>
          </g>
        )}
        {all.map((p, i) =>
          p.kind === 'real' ? (
            n <= 40 || i === hover ? (
              <circle
                key={p.date}
                cx={x(i)}
                cy={y(p.value)}
                r={i === hover ? 5 : 3}
                fill="hsl(var(--card))"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
            ) : null
          ) : (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.value)}
              r={i === hover ? 5 : 3.5}
              fill="hsl(var(--card))"
              stroke="#d97706"
              strokeWidth="2"
              strokeDasharray="2 2"
            />
          ),
        )}
        {labeled &&
          all.map((p, i) => {
            if (p.kind !== 'real' || !p.value) return null
            // Si los puntos estan muy juntos, solo el total; el desglose queda en el recuadro al tocar.
            const gap = iw / Math.max(1, n - 1)
            if (gap < 28) return null
            const roomy = gap >= 46
            const parts = roomy ? p.parts || [] : []
            const top = y(p.value) - 10
            return (
              <g key={`lbl-${p.date}`} pointerEvents="none">
                <text
                  x={x(i)}
                  y={top}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="800"
                  fill="hsl(var(--foreground))"
                  className="tabular"
                >
                  {fmtInt(p.value)}
                </text>
                {parts.map((m, k) => (
                  <text
                    key={m.label}
                    x={x(i)}
                    y={top - 13 - k * 12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="hsl(var(--muted-foreground))"
                    className="tabular"
                  >
                    {m.label} {fmtInt(m.n)}
                  </text>
                ))}
              </g>
            )
          })}
        {h && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={pad.t + ih}
            stroke="hsl(var(--muted-foreground))"
            strokeOpacity="0.4"
          />
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-2.5 py-1.5 text-[12px] shadow-md"
          style={{ left: Math.max(56, Math.min(width - 56, x(hover))) }}
        >
          <div className="font-semibold text-muted-foreground">{fmtYmd(h.date)}</div>
          <div className="tabular text-[14px] font-extrabold">
            {fmtInt(h.value)}{' '}
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {h.kind === 'proj' ? 'proyectado' : 'piezas'}
            </span>
          </div>
          {h.parts?.map((m) => (
            <div key={m.label} className="tabular flex justify-between gap-3 text-[12px]">
              <span className="font-semibold text-muted-foreground">{m.label}</span>
              <span className="font-bold">{fmtInt(m.n)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ items, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground',
        className,
      )}
    >
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="22" height="10" aria-hidden="true">
            <line
              x1="1"
              x2="21"
              y1="5"
              y2="5"
              stroke={it.color}
              strokeWidth="2.5"
              strokeDasharray={it.dashed ? '4 3' : undefined}
              strokeLinecap="round"
            />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

// Barras horizontales (HTML, se adaptan solas al ancho).
export function HBars({ items, format = fmtInt, className }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0))
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-semibold">{it.label}</span>
            <span className="tabular shrink-0 font-bold">
              {format(it.value)}
              {it.hint && <span className="ml-1.5 font-medium text-muted-foreground">{it.hint}</span>}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-500', it.className || 'bg-primary')}
              style={{ width: `${((it.value || 0) / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Barras agrupadas Plan (azul claro) vs Real (azul marino), con el valor arriba de cada barra.
 *  groups: [{ key, label, sub, plan, real }]
 */
export function PlanRealBars({ groups, height = 220, className }) {
  const [ref, width] = useWidth(480)
  const pad = { l: 40, r: 8, t: 22, b: groups.some((g) => g.sub) ? 40 : 26 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...groups.flatMap((g) => [g.plan, g.real])) * 1.08)
  const y = (v) => pad.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  const slot = iw / Math.max(1, groups.length)
  const bw = Math.max(4, Math.min(52, slot * 0.32))
  const showValues = bw >= 14
  return (
    <div ref={ref} className={cn('w-full select-none', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Plan contra real"
        className="block"
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
        {groups.map((g, i) => {
          const cx = pad.l + slot * i + slot / 2
          const bars = [
            { k: 'plan', v: g.plan, x: cx - bw - 2, cls: 'fill-blue-400 dark:fill-blue-900' },
            { k: 'real', v: g.real, x: cx + 2, cls: 'fill-[hsl(var(--primary))]' },
          ]
          return (
            <g key={g.key}>
              {bars.map((b) => (
                <g key={b.k}>
                  <rect
                    x={b.x}
                    y={y(b.v)}
                    width={bw}
                    height={Math.max(0, y(0) - y(b.v))}
                    rx="3"
                    className={b.cls}
                  >
                    <title>{`${b.k === 'plan' ? 'Plan' : 'Real'} ${fmtInt(b.v)}`}</title>
                  </rect>
                  {showValues && b.v > 0 && (
                    <text
                      x={b.x + bw / 2}
                      y={y(b.v) - 5}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="hsl(var(--foreground))"
                      className="tabular"
                    >
                      {fmtInt(b.v)}
                    </text>
                  )}
                </g>
              ))}
              <text
                x={cx}
                y={height - (g.sub ? 22 : 8)}
                textAnchor="middle"
                fontSize="11.5"
                fill="hsl(var(--muted-foreground))"
              >
                {g.label}
              </text>
              {g.sub && (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="hsl(var(--muted-foreground))"
                >
                  {g.sub}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
