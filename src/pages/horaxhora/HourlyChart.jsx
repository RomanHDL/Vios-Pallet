// Grafica "Conteo por hora" (mismo diseno que Centro de Trabajo), dibujada en SVG al tamano real del
// contenedor: barras por hora coloreadas contra su meta, diferencia arriba, linea de tendencia,
// meta esperada punteada (100%) y tramos de comida con su meta reducida.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtInt } from '@/lib/utils'
import { barKind, COLORS, goalLines } from './slots'

const GOAL = '#16A34A'
const GOAL_TEXT = 'fill-[#15803D] dark:fill-[#4ADE80]'
const BAD_TEXT = 'fill-[#DC2626] dark:fill-[#F87171]'
const TREND = '#CBD5E1'

function useSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight })
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

function fontFor(width, big) {
  if (big) return Math.max(13, Math.min(18, width / 50))
  if (width >= 1400) return 17
  if (width >= 1000) return 14
  if (width >= 700) return 12
  return 10
}

const signed = (n) => (n > 0 ? `+${fmtInt(n)}` : fmtInt(n))

// Curva monotona (sin sobrepasar los puntos), como type="monotone" de recharts.
function monotonePath(pts) {
  if (pts.length < 2) return ''
  const n = pts.length
  const d = []
  const m = []
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x))
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  let path = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1].x - pts[i].x) / 3
    path += `C${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - m[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return path
}

function topRounded(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export function HourlyChart({ slots, big, className }) {
  const [ref, { width, height }] = useSize()
  const phone = width > 0 && width < 640
  const fs = fontFor(width, big)
  const minBar = Math.round(fs * 1.6 + 8)
  const top = fs * 2 + 10
  const bottom = fs * 2 + 24
  const left = Math.max(40, fs * 3.2)
  const right = fs * 3.4 + 8
  const plotW = Math.max(1, width - left - right)
  const plotH = Math.max(1, height - top - bottom)
  const goals = goalLines(slots)

  const maxValue = Math.max(1, goals.base || 0, ...slots.map((s) => s.real))
  const step = maxValue > 500 ? 100 : maxValue > 100 ? 50 : 10
  const niceMax = Math.ceil((maxValue * 1.12) / step) * step
  const y = (v) => top + plotH * (1 - v / niceMax)
  const band = plotW / Math.max(1, slots.length)
  const barW = Math.min(72 * (big ? 1.4 : 1), band * 0.84)
  const cx = (i) => left + band * i + band / 2
  const barTop = (s) => Math.min(y(s.status === 'future' ? 0 : s.real), top + plotH - minBar)

  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((niceMax / 5) * i))
  const trend = slots
    .map((s, i) => (s.status === 'future' ? null : { x: cx(i), y: barTop(s) }))
    .filter(Boolean)
  const currentIdx = slots.findIndex((s) => s.status === 'current')
  const goalFs = Math.max(9, fs - 1)

  return (
    <div ref={ref} className={className}>
      {width > 0 && height > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Conteo por hora"
          className="block select-none"
        >
          {/* Cuadricula y eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="rgba(100,116,139,.15)" />
              <text
                x={left - 10}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={Math.max(11, fs - 2)}
                className="fill-muted-foreground"
              >
                {fmtInt(t)}
              </text>
            </g>
          ))}

          {/* Hora actual */}
          {currentIdx >= 0 && (
            <rect
              x={left + band * currentIdx}
              y={top}
              width={band}
              height={plotH}
              fill={COLORS.current}
              fillOpacity={0.08}
            />
          )}

          {/* Barras */}
          {slots.map((s, i) => {
            const kind = barKind(s)
            const by = barTop(s)
            const bh = top + plotH - by
            const x = cx(i) - barW / 2
            const value = kind === 'future' ? '–' : fmtInt(s.real)
            const pct = kind === 'met' || kind === 'below' ? Math.round((s.real / s.plan) * 100) : null
            const ifs = Math.min(fs, Math.max(8, (barW - 4) / (Math.max(value.length, 2) * 0.62)))
            const small = Math.max(7.5, ifs * 0.78)
            const two = kind !== 'future' && bh >= ifs + small + 12
            const mid = by + bh / 2
            const fill = '#fff'
            const diff = pct === null ? null : s.real - s.plan
            const dfs = Math.min(fs, Math.max(8, (barW + 10) / 4.2))
            return (
              <g key={s.key}>
                <title>
                  {`${s.key}: ${fmtInt(s.real)} pzs${s.plan > 0 ? ` · meta ${fmtInt(s.plan)}` : ''}${pct !== null ? ` · ${pct}%` : ''}`}
                </title>
                <path
                  d={topRounded(x, by, barW, bh, 8)}
                  fill={kind === 'future' ? 'hsl(var(--muted))' : COLORS[kind]}
                />
                {kind === 'future' ? (
                  <text
                    x={cx(i)}
                    y={mid}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ifs}
                    fontWeight={800}
                    className="fill-muted-foreground"
                  >
                    –
                  </text>
                ) : two ? (
                  <>
                    <text
                      x={cx(i)}
                      y={mid - small * 0.55}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={ifs}
                      fontWeight={800}
                      fill={fill}
                    >
                      {value}
                    </text>
                    <text
                      x={cx(i)}
                      y={mid + ifs * 0.6}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={small}
                      fontWeight={600}
                      fill={fill}
                      fillOpacity={0.92}
                    >
                      {pct === null ? '–' : `${pct}%`}
                    </text>
                  </>
                ) : (
                  <text
                    x={cx(i)}
                    y={mid}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ifs}
                    fontWeight={800}
                    fill={fill}
                  >
                    {value}
                  </text>
                )}
                {diff !== null && (
                  <text
                    x={cx(i)}
                    y={by - 10}
                    textAnchor="middle"
                    fontSize={dfs}
                    fontWeight={800}
                    className={diff < 0 ? BAD_TEXT : GOAL_TEXT}
                  >
                    {two ? signed(diff) : `${signed(diff)} · ${pct}%`}
                  </text>
                )}
              </g>
            )
          })}

          {/* Tendencia */}
          {trend.length > 1 && <path d={monotonePath(trend)} fill="none" stroke={TREND} strokeWidth={1.6} />}
          {slots.map((s, i) =>
            s.status === 'future' ? null : (
              <circle
                key={s.key}
                cx={cx(i)}
                cy={barTop(s)}
                r={big ? 4.5 : 3.5}
                fill="#fff"
                stroke={COLORS[barKind(s)]}
                strokeWidth={2}
              />
            ),
          )}

          {/* Meta esperada */}
          {goals.base !== null && (
            <g pointerEvents="none">
              <line
                x1={left}
                x2={left + plotW}
                y1={y(goals.base)}
                y2={y(goals.base)}
                stroke={GOAL}
                strokeWidth={1.8}
                strokeDasharray="7 5"
              />
              <text
                x={left + plotW + 6}
                y={y(goals.base) - goalFs * 0.15}
                fontSize={goalFs}
                fontWeight={800}
                className={GOAL_TEXT}
              >
                100%
              </text>
              <text
                x={left + plotW + 6}
                y={y(goals.base) + goalFs * 1.05}
                fontSize={goalFs}
                fontWeight={800}
                className={GOAL_TEXT}
              >
                {`${fmtInt(goals.base)} p`}
              </text>
            </g>
          )}
          {goals.runs.map((run) => {
            const x1 = left + band * run.from + band * 0.08
            const x2 = left + band * (run.to + 1) - band * 0.08
            const gy = y(run.plan)
            const pfs = goalFs * 0.85
            const label = `${fmtInt(run.plan)} p`
            const pw = label.length * pfs * 0.62 + 10
            const ph = pfs + 6
            // La pastilla va sobre la hora del tramo con la barra mas baja, arriba de su diferencia,
            // para no tapar los numeros de una barra alta.
            const clear = (i) =>
              (slots[i].status === 'future' ? top + plotH - minBar : barTop(slots[i]) - 10 - fs) - ph / 2 - 3
            let host = run.from
            for (let i = run.from; i <= run.to; i++) if (clear(i) > clear(host)) host = i
            const py = Math.min(gy - goalFs * 0.95, clear(host))
            const pc = Math.min(cx(host), x2 - pw / 2)
            return (
              <g key={run.from} pointerEvents="none">
                <line x1={x1} x2={x2} y1={gy} y2={gy} stroke={GOAL} strokeWidth={1.8} strokeDasharray="5 4" />
                <rect
                  x={pc - pw / 2}
                  y={py - ph / 2}
                  width={pw}
                  height={ph}
                  rx={ph / 2}
                  fill="hsl(var(--card))"
                  stroke={GOAL}
                  strokeWidth={1.2}
                />
                <text
                  x={pc}
                  y={py}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={pfs}
                  fontWeight={800}
                  className={GOAL_TEXT}
                >
                  {label}
                </text>
              </g>
            )
          })}

          {/* Eje X con la pastilla "Hora actual" */}
          {slots.map((s, i) => {
            const isCur = s.status === 'current'
            const label = phone ? String(s.hour) : s.key
            const pillH = fs + 6
            const pillW = Math.max(58, 'Hora actual'.length * (fs - 1) * 0.62 + 16)
            const ty = top + plotH
            return (
              <g key={s.key} transform={`translate(${cx(i)},${ty})`}>
                <text
                  y={fs + 6}
                  textAnchor="middle"
                  fontSize={fs}
                  fontWeight={isCur ? 800 : 700}
                  fill={isCur ? COLORS.current : 'hsl(var(--muted-foreground))'}
                >
                  {label}
                </text>
                {isCur &&
                  (phone ? (
                    <circle cx={0} cy={fs + 16} r={3} fill={COLORS.current} />
                  ) : (
                    <g>
                      <rect
                        x={-pillW / 2}
                        y={fs + 13}
                        width={pillW}
                        height={pillH}
                        rx={pillH / 2}
                        fill={COLORS.current}
                      />
                      <text
                        y={fs + 13 + pillH / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fs - 1.5}
                        fontWeight={800}
                        fill="#fff"
                      >
                        Hora actual
                      </text>
                    </g>
                  ))}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function HourlyLegend({ className }) {
  const items = [
    [COLORS.met, 'Meta cumplida'],
    [COLORS.below, 'Bajo meta'],
    [COLORS.current, 'Hora actual'],
    ['hsl(var(--muted))', 'Pendiente'],
  ]
  return (
    <div className={className}>
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: c }} />
          {l}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 border-t-2 border-dashed" style={{ borderColor: GOAL }} />
        Meta esperada
      </span>
    </div>
  )
}
