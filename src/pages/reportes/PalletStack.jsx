// Tarima de madera con cajas de televisor apiladas (SVG en perspectiva). Se llena de abajo hacia arriba segun el
// avance de la salida; los lugares que faltan se dibujan como cajas transparentes.
import { useId } from 'react'
import { filledSlots } from './palletView'

const COLS = 3
const ROWS = 2
const LAYERS = 3
const SLOTS = COLS * ROWS * LAYERS

// Medidas de una caja y desplazamiento de profundidad (proyeccion oblicua hacia arriba a la derecha).
const W = 36
const H = 31
const OX = 13
const OY = -10
const X0 = 6
const Y0 = 128

// Orden de llenado: por capa (de abajo hacia arriba), fila de atras primero, de izquierda a derecha.
function fillOrder() {
  const list = []
  for (let l = 0; l < LAYERS; l++) for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) list.push(`${c}|${r}|${l}`)
  return list
}
const ORDER = fillOrder()

const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function Box({ c, r, l, filled, ids, inches }) {
  const x = X0 + c * W + r * OX
  const y = Y0 - l * H + r * OY
  const front = [
    [x, y],
    [x + W, y],
    [x + W, y - H],
    [x, y - H],
  ]
  const top = [
    [x, y - H],
    [x + W, y - H],
    [x + W + OX, y - H + OY],
    [x + OX, y - H + OY],
  ]
  const side = [
    [x + W, y],
    [x + W + OX, y + OY],
    [x + W + OX, y - H + OY],
    [x + W, y - H],
  ]
  if (!filled) {
    return (
      <g className="pallet-ghost">
        <polygon points={pts(side)} fill="rgba(148,163,184,0.10)" stroke="rgba(148,163,184,0.55)" strokeWidth="0.7" />
        <polygon points={pts(top)} fill="rgba(226,232,240,0.16)" stroke="rgba(148,163,184,0.55)" strokeWidth="0.7" />
        <polygon points={pts(front)} fill="rgba(203,213,225,0.12)" stroke="rgba(148,163,184,0.65)" strokeWidth="0.7" />
      </g>
    )
  }
  // Cinta del carton: franja al centro de la tapa, de frente hacia atras.
  const tx = x + W / 2
  const tape = [
    [tx - 2.2, y - H],
    [tx + 2.2, y - H],
    [tx + 2.2 + OX, y - H + OY],
    [tx - 2.2 + OX, y - H + OY],
  ]
  return (
    <g>
      <polygon points={pts(side)} fill={`url(#${ids.side})`} stroke="rgba(92,58,26,0.45)" strokeWidth="0.6" />
      <polygon points={pts(top)} fill={`url(#${ids.top})`} stroke="rgba(92,58,26,0.4)" strokeWidth="0.6" />
      <polygon points={pts(tape)} fill="rgba(255,236,204,0.45)" />
      <polygon points={pts(front)} fill={`url(#${ids.front})`} stroke="rgba(92,58,26,0.5)" strokeWidth="0.6" />
      <text x={x + 4} y={y - 6} fontSize="9.5" fontWeight="900" fill="#3b2614" fontFamily="Inter, system-ui, sans-serif" letterSpacing="-0.6">
        MI
      </text>
      {inches && (
        <text x={x + W - 4} y={y - H + 11} fontSize="8" fontWeight="800" fill="#4a2f17" textAnchor="end" fontFamily="Inter, system-ui, sans-serif">
          {inches}"
        </text>
      )}
    </g>
  )
}

function PalletBase({ ids }) {
  const PW = COLS * W
  const RX = ROWS * OX
  const RY = ROWS * OY
  const deck = [
    [X0, Y0],
    [X0 + PW, Y0],
    [X0 + PW + RX, Y0 + RY],
    [X0 + RX, Y0 + RY],
  ]
  const sideBand = (y1, y2) => [
    [X0 + PW, y1],
    [X0 + PW + RX, y1 + RY],
    [X0 + PW + RX, y2 + RY],
    [X0 + PW, y2],
  ]
  const blocks = [X0, X0 + PW / 2 - 8, X0 + PW - 16]
  return (
    <g>
      {/* Sombra en el piso */}
      <ellipse cx={X0 + PW / 2 + RX / 2} cy={Y0 + 21} rx={PW / 2 + RX / 2 + 6} ry="5" fill="rgba(15,23,42,0.18)" />
      {/* Tablas de arriba */}
      <polygon points={pts(deck)} fill={`url(#${ids.woodTop})`} stroke="rgba(92,58,26,0.45)" strokeWidth="0.6" />
      {[1, 2, 3, 4].map((k) => {
        const f = k / 5
        return (
          <line
            key={k}
            x1={X0 + PW * f}
            y1={Y0}
            x2={X0 + PW * f + RX}
            y2={Y0 + RY}
            stroke="rgba(92,58,26,0.35)"
            strokeWidth="0.8"
          />
        )
      })}
      {/* Canto de la tabla de arriba */}
      <rect x={X0} y={Y0} width={PW} height="5" fill="#C99460" stroke="rgba(92,58,26,0.5)" strokeWidth="0.6" />
      <polygon points={pts(sideBand(Y0, Y0 + 5))} fill="#A9763F" stroke="rgba(92,58,26,0.5)" strokeWidth="0.6" />
      {/* Hueco entre bloques */}
      <rect x={X0} y={Y0 + 5} width={PW} height="9" fill="#4b3018" opacity="0.75" />
      <polygon points={pts(sideBand(Y0 + 5, Y0 + 14))} fill="#3d2713" opacity="0.75" />
      {blocks.map((bx) => (
        <rect key={bx} x={bx} y={Y0 + 5} width="16" height="9" fill="#C0894F" stroke="rgba(92,58,26,0.55)" strokeWidth="0.6" />
      ))}
      <polygon points={pts([[X0 + PW, Y0 + 5], [X0 + PW + RX, Y0 + 5 + RY], [X0 + PW + RX, Y0 + 14 + RY], [X0 + PW, Y0 + 14]])} fill="#9C6A36" opacity="0.9" />
      {/* Tabla de abajo */}
      <rect x={X0} y={Y0 + 14} width={PW} height="4" fill="#BD8650" stroke="rgba(92,58,26,0.5)" strokeWidth="0.6" />
      <polygon points={pts(sideBand(Y0 + 14, Y0 + 18))} fill="#94632F" stroke="rgba(92,58,26,0.5)" strokeWidth="0.6" />
    </g>
  )
}

export function PalletStack({ progress = 0, model, className }) {
  const uid = useId().replace(/:/g, '')
  const ids = { front: `pf${uid}`, side: `ps${uid}`, top: `pt${uid}`, woodTop: `pw${uid}` }
  const filled = new Set(ORDER.slice(0, filledSlots(progress, SLOTS)))
  const inches = String(model || '').match(/(\d{2})/)?.[1]
  const boxes = []
  // Orden de pintado: fila de atras primero, de abajo hacia arriba, de izquierda a derecha.
  for (let r = ROWS - 1; r >= 0; r--)
    for (let l = 0; l < LAYERS; l++)
      for (let c = 0; c < COLS; c++) {
        const k = `${c}|${r}|${l}`
        boxes.push(<Box key={k} c={c} r={r} l={l} filled={filled.has(k)} ids={ids} inches={inches} />)
      }
  return (
    <svg viewBox="0 0 150 156" className={className} role="img" aria-label={`Tarima ${Math.round((progress || 0) * 100)}% llena`}>
      <defs>
        <linearGradient id={ids.front} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0A86B" />
          <stop offset="100%" stopColor="#C68A4F" />
        </linearGradient>
        <linearGradient id={ids.side} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#B37A42" />
          <stop offset="100%" stopColor="#9A6632" />
        </linearGradient>
        <linearGradient id={ids.top} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#EDC08A" />
          <stop offset="100%" stopColor="#E2AE74" />
        </linearGradient>
        <linearGradient id={ids.woodTop} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#DDB07A" />
          <stop offset="100%" stopColor="#CFA06A" />
        </linearGradient>
      </defs>
      <PalletBase ids={ids} />
      {boxes}
    </svg>
  )
}
