// Turnos de la planta (zona America/Monterrey). Compartido entre servidor y cliente.
//  - Turno 1: 07:00 a 22:00 (9h10m regulares; desde las 17:10 cuenta como tiempo extra).
//  - Turno 2: 22:00 a 07:00 del dia siguiente.
// La "fecha de turno" es la fecha en que EMPIEZA el turno, asi el Turno 2 no se parte en dos dias
// (PalletScan agrupaba por fecha de calendario y la noche quedaba dividida).
export const PLANT_TZ = 'America/Monterrey'
export const SHIFTS = [
  { key: 'T1', label: 'Turno 1', start: '07:00', end: '22:00', hours: 15, overtimeFrom: '17:10' },
  { key: 'T2', label: 'Turno 2', start: '22:00', end: '07:00', hours: 9 },
]

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLANT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function plantParts(d = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) }
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// Turno al que pertenece un instante: { shiftDate, shift }.
export function shiftOf(d = new Date()) {
  const { date, hour } = plantParts(d)
  if (hour >= 7 && hour < 22) return { shiftDate: date, shift: 'T1' }
  if (hour >= 22) return { shiftDate: date, shift: 'T2' }
  return { shiftDate: addDays(date, -1), shift: 'T2' }
}

// Hora de la planta (0-23) relativa al inicio del turno: indice de "hora del turno".
export function hourOfShift(d, shift) {
  const { hour } = plantParts(d)
  return shift === 'T1' ? hour - 7 : (hour - 22 + 24) % 24
}

export function shiftLabel(key) {
  return SHIFTS.find((s) => s.key === key)?.label || key
}

export function todayPlant() {
  return plantParts().date
}

// Dias habiles (lunes a viernes, sin feriados oficiales de Mexico).
function nthMonday(year, month, n) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const offset = (8 - first) % 7
  return `${year}-${String(month).padStart(2, '0')}-${String(1 + offset + 7 * (n - 1)).padStart(2, '0')}`
}
export function isHoliday(ymd) {
  const [y] = ymd.split('-').map(Number)
  const md = ymd.slice(5)
  if (['01-01', '05-01', '09-16', '12-25'].includes(md)) return true
  return [nthMonday(y, 2, 1), nthMonday(y, 3, 3), nthMonday(y, 11, 3)].includes(ymd)
}
export function isWorkday(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow !== 0 && dow !== 6 && !isHoliday(ymd)
}
