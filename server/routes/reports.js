import { eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { addDays, isWorkday, shiftOf, todayPlant } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { lines, models } from '../schema.js'
import { pace } from '../../shared/pace.js'
import { shiftGoal, shiftOutput } from '../output.js'
import { clean, isYmd, rows } from '../util.js'

const r = Router()

function range(q, defDays = 0) {
  const to = isYmd(q.to) ? q.to : todayPlant()
  const from = isYmd(q.from) ? q.from : addDays(to, -defDays)
  return from <= to ? { from, to } : { from: to, to: from }
}
const brandCond = (q, col = sql`brand`) =>
  q.brand ? sql`${col} = ${clean(q.brand, 20)}` : sql`true`

function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/* Plan vs Processed por turno.
   Plan = lo capturado en "Plan del turno" por linea; si no se capturo:
     - Turno 1 en dia habil (desde el primer dia con produccion): meta de cada linea activa.
     - Turno 2 (o fin de semana / feriado): meta solo de las lineas que trabajaron.
   (PalletScan sumaba 400 por cada linea que registro aunque fuera 1 pieza, y ninguna si no registro.)
   Delta = Processed - Plan (negativo = faltante).
   Recovery = Plan + faltante del turno anterior con plan, para recuperar lo pendiente. */
r.get('/reports/day', requireAuth(), async (req, res) => {
  const { from, to } = range(req.query, 0)
  const activeLines = await db.select().from(lines).where(eq(lines.active, true))
  const goalBy = Object.fromEntries(activeLines.map((l) => [l.name, l.goal]))
  const prev = addDays(from, -7)
  const prod = await rows(sql`
    select shift_date, shift, line, count(*)::int n from production
    where shift_date between ${prev} and ${to} and ${brandCond(req.query)}
    group by 1, 2, 3`)
  const rej = await rows(sql`
    select shift_date, shift, count(*)::int n from rejections
    where shift_date between ${prev} and ${to} and ${brandCond(req.query)} group by 1, 2`)
  const planRows = await rows(sql`select shift_date, shift, line, planned from plans where shift_date between ${prev} and ${to}`)
  const staff = await rows(sql`select shift_date, shift, line, people from staffing where shift_date between ${prev} and ${to}`)
  // La meta automatica solo cuenta desde el primer dia con produccion (antes la app no se usaba).
  const [{ first }] = await rows(sql`select min(shift_date) as first from production`)

  const shifts = []
  for (const d of eachDay(prev, to)) {
    for (const s of ['T1', 'T2']) {
      const pr = prod.filter((x) => x.shift_date === d && x.shift === s)
      const pl = planRows.filter((x) => x.shift_date === d && x.shift === s)
      const st = staff.filter((x) => x.shift_date === d && x.shift === s)
      const lineNames = new Set([...Object.keys(goalBy), ...pr.map((x) => x.line)])
      const byLine = [...lineNames]
        .map((line) => {
          const processed = pr.find((x) => x.line === line)?.n || 0
          const captured = pl.find((x) => x.line === line)?.planned
          const worked = processed > 0
          let plan = 0
          if (captured !== undefined) plan = captured
          else if (s === 'T1' && isWorkday(d) && first && d >= first) plan = goalBy[line] || 0
          else if (worked) plan = goalBy[line] || 0
          return {
            line,
            plan,
            planCaptured: captured !== undefined,
            processed,
            people: st.find((x) => x.line === line)?.people ?? null,
          }
        })
        .filter((x) => x.plan || x.processed)
        .sort((a, b) => a.line.localeCompare(b.line))
      const plan = byLine.reduce((a, x) => a + x.plan, 0)
      const processed = byLine.reduce((a, x) => a + x.processed, 0)
      if (!plan && !processed) continue
      shifts.push({
        shiftDate: d,
        shift: s,
        plan,
        processed,
        rejected: rej.find((x) => x.shift_date === d && x.shift === s)?.n || 0,
        delta: processed - plan,
        pct: plan ? processed / plan : null,
        people: byLine.some((x) => x.people !== null)
          ? byLine.reduce((a, x) => a + (x.people || 0), 0)
          : null,
        lines: byLine,
      })
    }
  }
  // Recovery: faltante del turno anterior (con plan) que se arrastra.
  for (let i = 0; i < shifts.length; i++) {
    const before = shifts.slice(0, i).reverse().find((x) => x.plan > 0)
    const carry = before ? Math.max(0, -before.delta) : 0
    shifts[i].carryOver = carry
    shifts[i].recoveryPlan = shifts[i].plan + carry
  }
  const inRange = shifts.filter((x) => x.shiftDate >= from)
  const totals = inRange.reduce(
    (a, x) => ({
      plan: a.plan + x.plan,
      processed: a.processed + x.processed,
      rejected: a.rejected + x.rejected,
    }),
    { plan: 0, processed: 0, rejected: 0 },
  )
  totals.delta = totals.processed - totals.plan
  totals.pct = totals.plan ? totals.processed / totals.plan : null
  res.json({ from, to, shifts: inRange, totals })
})

// Produccion por dia y modelo + objetivos MTY/Texas + proyeccion.
r.get('/reports/models', requireAuth(), async (req, res) => {
  const allModels = await db.select().from(models).orderBy(models.sort, models.code)
  const activeLines = await db.select().from(lines).where(eq(lines.active, true))
  const capacity = activeLines.reduce((a, l) => a + l.goal, 0) || 400
  const daily = await rows(sql`
    select shift_date, model, count(*)::int n from production
    where ${brandCond(req.query)} group by 1, 2 order by 1`)
  const rejectedIn = await rows(sql`
    select model, count(*)::int n from rejections where in_production and ${brandCond(req.query)} group by 1`)
  const days = [...new Set(daily.map((x) => x.shift_date))].sort()
  const byDay = days.map((d) => {
    const row = { date: d, total: 0 }
    for (const m of allModels) {
      row[m.code] = daily.find((x) => x.shift_date === d && x.model === m.code)?.n || 0
      row.total += row[m.code]
    }
    return row
  })
  const modelsOut = allModels.map((m) => {
    const produced = daily.filter((x) => x.model === m.code).reduce((a, x) => a + x.n, 0)
    const rejected = rejectedIn.find((x) => x.model === m.code)?.n || 0
    const net = produced - rejected
    const target = m.targetMty + m.targetTexas
    return {
      code: m.code,
      produced,
      rejected,
      net,
      targetMty: m.targetMty,
      targetTexas: m.targetTexas,
      target,
      pct: target ? net / target : null,
      remaining: Math.max(0, target - net),
    }
  })
  const totals = byDay.map((x) => x.total)
  const sum = totals.reduce((a, x) => a + x, 0)
  // Proyeccion: regresion lineal de los ultimos 10 dias con produccion, topada a la capacidad.
  const recent = totals.slice(-10)
  let projection = []
  if (recent.length >= 2) {
    const n = recent.length
    const xs = recent.map((_, i) => i)
    const mx = (n - 1) / 2
    const my = recent.reduce((a, y) => a + y, 0) / n
    const slope =
      xs.reduce((a, x, i) => a + (x - mx) * (recent[i] - my), 0) /
      xs.reduce((a, x) => a + (x - mx) ** 2, 0)
    let d = todayPlant()
    let k = 1
    while (projection.length < 5) {
      d = addDays(d, 1)
      if (!isWorkday(d)) continue
      const y = Math.round(my + slope * (n - 1 - mx + k))
      projection.push({ date: d, value: Math.max(0, Math.min(capacity, y)) })
      k++
    }
  }
  res.json({
    models: modelsOut,
    byDay,
    totals: {
      produced: sum,
      rejected: modelsOut.reduce((a, x) => a + x.rejected, 0),
      net: sum - modelsOut.reduce((a, x) => a + x.rejected, 0),
      avgPerDay: days.length ? Math.round(sum / days.length) : 0,
      bestDay: totals.length ? Math.max(...totals) : 0,
      daysWithProduction: days.length,
      capacity,
    },
    projection,
  })
})

// Personal por turno y productividad (piezas por persona).
r.get('/reports/staffing', requireAuth(), async (req, res) => {
  const { from, to } = range(req.query, 6)
  const staff = await rows(sql`select shift_date, shift, line, people from staffing where shift_date between ${from} and ${to}`)
  const prod = await rows(sql`
    select shift_date, shift, line, count(*)::int n from production
    where shift_date between ${from} and ${to} group by 1, 2, 3`)
  const keys = new Map()
  for (const x of [...staff, ...prod]) keys.set(`${x.shift_date}|${x.shift}|${x.line}`, x)
  const list = [...keys.keys()].sort().map((k) => {
    const [shiftDate, shift, line] = k.split('|')
    const people = staff.find((x) => x.shift_date === shiftDate && x.shift === shift && x.line === line)?.people ?? null
    const produced = prod.find((x) => x.shift_date === shiftDate && x.shift === shift && x.line === line)?.n || 0
    return { shiftDate, shift, line, people, produced, perPerson: people ? produced / people : null }
  })
  res.json({ from, to, rows: list })
})

// Dashboard de pallets: entrada -> salida.
r.get('/reports/pallets', requireAuth(), async (req, res) => {
  const { from, to } = range(req.query, 0)
  const list = await rows(sql`
    select e.id, e.model, e.brand, e.status as entrada_status, e.item_count as pieces_in,
           e.created_at, e.closed_at,
           s.id as salida_id, s.status as salida_status, s.missing_count, s.extras_count, s.closed_at as salida_closed_at,
           (select count(*)::int from pallet_items si where si.pallet_id = s.id) as pieces_out,
           (select count(*)::int from pallet_items ei where ei.pallet_id = e.id) as live_in
    from pallets e
    left join pallets s on s.linked_pallet_id = e.id
    where e.type = 'entrada' and ${brandCond(req.query, sql`e.brand`)}
      and (e.created_at at time zone 'America/Monterrey')::date between ${from}::date and ${to}::date
    order by e.created_at desc`)
  const out = list.map((x) => {
    let state = 'consolidado'
    if (x.entrada_status === 'abierto') state = 'escaneando'
    else if (!x.salida_id) state = 'sin_salida'
    else if (x.salida_status === 'abierto') state = 'en_proceso'
    else if (x.missing_count > 0) state = 'con_faltantes'
    return { ...x, pieces_in: x.entrada_status === 'abierto' ? x.live_in : x.pieces_in, state }
  })
  const count = (s) => out.filter((x) => x.state === s).length
  res.json({
    from,
    to,
    pallets: out,
    totals: {
      total: out.length,
      escaneando: count('escaneando'),
      sin_salida: count('sin_salida'),
      en_proceso: count('en_proceso'),
      con_faltantes: count('con_faltantes'),
      consolidado: count('consolidado'),
      piecesIn: out.reduce((a, x) => a + (x.pieces_in || 0), 0),
      piecesOut: out.reduce((a, x) => a + (x.pieces_out || 0), 0),
      missing: out.reduce((a, x) => a + (x.missing_count || 0), 0),
    },
  })
})

// Inicio: resumen del turno actual.
r.get('/dashboard', requireAuth(), async (_req, res) => {
  const { shiftDate, shift } = shiftOf()
  // Mismo conteo y meta que Hora por Hora: piezas de salidas + registradas, meta del turno (765 por defecto).
  const output = await shiftOutput(shiftDate, shift)
  const produced = output.length
  const { goal } = await shiftGoal(shiftDate, shift)
  const [{ n: rejected }] = await rows(sql`select count(*)::int n from rejections where shift_date = ${shiftDate}`)
  const open = await rows(sql`select type, count(*)::int n from pallets where status = 'abierto' group by 1`)
  const [{ n: withMissing }] = await rows(sql`
    select count(*)::int n from pallets where type = 'salida' and missing_count > 0
      and (closed_at at time zone 'America/Monterrey')::date >= ${addDays(todayPlant(), -7)}::date`)
  const recent = await rows(sql`
    select 'produccion' as kind, serial as ref, line as detail, registered_at as at from production
    union all
    select 'rechazo', serial, (defects->>0), registered_at from rejections
    union all
    select 'pallet', id, type || ' · ' || status, coalesce(closed_at, created_at) from pallets
    order by at desc limit 8`)
  res.json({
    shiftDate,
    shift,
    produced,
    goal,
    pace: pace({ shiftDate, shift, count: produced, goal, firstAt: output[0]?.at }),
    rejected,
    openEntrada: open.find((x) => x.type === 'entrada')?.n || 0,
    openSalida: open.find((x) => x.type === 'salida')?.n || 0,
    withMissing7d: withMissing,
    recent,
  })
})

export default r
