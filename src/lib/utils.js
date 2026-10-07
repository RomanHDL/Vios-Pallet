import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { PLANT_TZ, shiftLabel } from '@shared/shift.js'

export const cn = (...a) => twMerge(clsx(a))

const nf = new Intl.NumberFormat('es-MX')
export const fmtInt = (n) => (n === null || n === undefined ? '—' : nf.format(Math.round(n)))
export const fmtPct = (v, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(digits)}%`

const timeFmt = new Intl.DateTimeFormat('es-MX', { timeZone: PLANT_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: PLANT_TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const fmtTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : '—')
export const fmtDateTime = (iso) => (iso ? dateTimeFmt.format(new Date(iso)).replace('.', '') : '—')

// "2026-10-07" -> "Mié 07 Oct"
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export function fmtYmd(ymd, { dow = true } = {}) {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${dow ? `${DOW[w]} ` : ''}${String(d).padStart(2, '0')} ${MON[m - 1]}`
}
export const fmtShift = (shiftDate, shift) => `${fmtYmd(shiftDate)} · ${shiftLabel(shift)}`

export function minutesAgo(iso) {
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}
export function fmtAgo(iso) {
  const m = minutesAgo(iso)
  if (m === null) return '—'
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `hace ${h} h ${m % 60} min` : `hace ${Math.floor(h / 24)} d`
}

// Sonido y vibracion de confirmacion al escanear (ok / error).
let ctx
export function feedback(ok) {
  try {
    if (navigator.vibrate) navigator.vibrate(ok ? 40 : [80, 60, 80])
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = ok ? 1040 : 220
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.35))
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + (ok ? 0.13 : 0.36))
  } catch {
    /* sin audio */
  }
}

export const ROLE_LABEL = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  calidad: 'Calidad',
}

export function canDo(user, roles) {
  if (!user) return false
  return user.role === 'admin' || roles.includes(user.role)
}
