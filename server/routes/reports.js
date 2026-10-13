import { sql } from 'drizzle-orm'
import { Router } from 'express'
import { DEFAULT_DAILY_GOAL, pace, shiftWindow } from '../../shared/pace.js'
import { projectProduction } from '../../shared/projection.js'
import { addDays, isWorkday, shiftOf, todayPlant } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import {
  areaActivity,
  BRANDS,
  brandSplit,
  closedExitItems,
  GOAL_SCOPE,
  outputByHour,
  outputByShift,
  palletsByDay,
  palletsByDayModel,
  shiftBrandSplit,
  shiftGoal,
  shiftOutput,
  WORK_AREAS,
} from '../output.js'
import { models } from '../schema.js'
import { clean, isYmd, rows } from '../util.js'

const r = Router()

function range(q, defDays = 0) {
  const to = isYmd(q.to) ? q.to : todayPlant()
  const from = isYmd(q.from) ? q.from : addDays(to, -defDays)
  return from <= to ? { from, to } : { from: to, to: from }
}
const brandCond = (q, col = sql`brand`) => (q.brand ? sql`${col} = ${clean(q.brand, 20)}` : sql`true`)

function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/* Plan vs Real por turno (mismo criterio que Inicio y Hora por Hora, server/output.js):
   Real = piezas de pallets de SALIDA CERRADOS escaneadas en el turno (sin dividir por linea).
   Plan = meta del turno (765 por defecto o la capturada en Hora por Hora, vigente hasta que se cambie):
     - Turno 1 en dia habil, desde el primer dia con salidas cerradas.
     - Turno 2, fines de semana y feriados: solo si se trabajo.
   Delta = Real - Plan (negativo = faltante).
   Recovery = Plan + faltante del turno anterior con plan, para recuperar lo pendiente. */
r.get('/reports/day', requireAuth(), async (req, res) => {
  const { from, to } = range(req.query, 0)
  const prev = addDays(from, -7)
  // Modelo opcional (Centro de reportes, 2026-10-10): solo cambia el Real; el Plan es la meta del turno.
  const model = req.query.model ? clean(req.query.model, 20) : null
  const count = await outputByShift(prev, to, req.query.brand ? clean(req.query.brand, 20) : null, model)
  const rej = await rows(sql`
    select shift_date, shift, count(*)::int n from rejections
    where shift_date between ${prev} and ${to} and ${brandCond(req.query)} group by 1, 2`)
  // Personas del turno (Reportes -> Personal del turno), suma de las lineas capturadas.
  // Personas del turno = areas de trabajo activas (ver areaActivity).
  const activity = await areaActivity(prev, to)
  const staff = Object.entries(activity).map(([k, a]) => {
    const [shift_date, shift] = k.split('|')
    return { shift_date, shift, n: Object.values(a).filter((v) => v > 0).length || null }
  })
  const goals = await rows(sql`
    select shift_date, shift, goal from hourly_goals where scope = ${GOAL_SCOPE} and shift_date <= ${to}
    order by shift_date`)
  const goalOf = (d, s) => {
    const g = goals.filter((x) => x.shift === s && x.shift_date <= d).at(-1)
    return { goal: g ? g.goal : DEFAULT_DAILY_GOAL, captured: Boolean(g) }
  }
  // La meta automatica solo cuenta desde el primer dia con produccion (antes la app no se usaba).
  const [{ first }] = await rows(sql`
    select least(
      (select min(i.scanned_at) from pallet_items i join pallets p on p.id = i.pallet_id
        where p.type = 'salida'),
      (select min(registered_at) from production)) as first`)
  const firstDay = first ? shiftOf(new Date(first)).shiftDate : null

  const shifts = []
  for (const d of eachDay(prev, to)) {
    for (const s of ['T1', 'T2']) {
      const processed = count[`${d}|${s}`] || 0
      const g = goalOf(d, s)
      let plan = 0
      if (s === 'T1' && isWorkday(d) && firstDay && d >= firstDay) plan = g.goal
      else if (processed > 0) plan = g.goal
      if (!plan && !processed) continue
      shifts.push({
        shiftDate: d,
        shift: s,
        plan,
        processed,
        rejected: rej.find((x) => x.shift_date === d && x.shift === s)?.n || 0,
        delta: processed - plan,
        pct: plan ? processed / plan : null,
        people: staff.find((x) => x.shift_date === d && x.shift === s)?.n ?? null,
        lines: [
          {
            line: 'Salidas cerradas',
            plan,
            planCaptured: g.captured,
            processed,
            people: staff.find((x) => x.shift_date === d && x.shift === s)?.n ?? null,
          },
        ],
      })
    }
  }
  // Recovery: faltante del turno anterior (con plan) que se arrastra.
  for (let i = 0; i < shifts.length; i++) {
    const before = shifts
      .slice(0, i)
      .reverse()
      .find((x) => x.plan > 0)
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
  // Division por marca (pallets y piezas) del rango.
  const brands = await brandSplit(
    shiftWindow(from, 'T1').start.toISOString(),
    shiftWindow(to, 'T2').end.toISOString(),
  )
  // Un solo dia: piezas por hora de cada turno (grafica del Centro de desempeno).
  const hours =
    from === to ? await outputByHour(from, req.query.brand ? clean(req.query.brand, 20) : null, model) : null
  res.json({ from, to, shifts: inRange, totals, brands, hours, current: shiftOf() })
})

// Produccion por dia y modelo + objetivos MTY/Texas + proyeccion.
r.get('/reports/models', requireAuth(), async (req, res) => {
  // Mismo conteo que Produccion / Hora por Hora: piezas de salidas cerradas, por fecha de turno del escaneo y
  // modelo del pallet. Rechazados = seriales producidos que Calidad rechazo. Referencia = meta del dia.
  const allModels = await db.select().from(models).orderBy(models.sort, models.code)
  const { goal: capacity } = await shiftGoal(todayPlant(), 'T1')
  const produced = await closedExitItems(req.query.brand ? clean(req.query.brand, 20) : null)
  const dailyMap = new Map()
  // Por dia y marca: piezas y pallets (para "los numeros de ese dia" arriba del reporte).
  const brandDay = new Map()
  // Por dia, modelo y marca (2026-10-09: "EL-32 SILO 20 + EL-32 HY 56 = 76").
  const splitMap = new Map()
  const addSplit = (d, model, brand, n) => {
    const k = `${d}|${model}|${brand}`
    splitMap.set(k, (splitMap.get(k) || 0) + n)
  }
  const brandRow = (d, b) => {
    const k = `${d}|${b}`
    if (!brandDay.has(k)) brandDay.set(k, { pieces: 0, pallets: 0 })
    return brandDay.get(k)
  }
  for (const x of produced) {
    const d = shiftOf(new Date(x.at)).shiftDate
    const k = `${d}|${x.model}`
    dailyMap.set(k, (dailyMap.get(k) || 0) + 1)
    brandRow(d, x.brand).pieces++
    addSplit(d, x.model, x.brand, 1)
  }
  for (const p of await palletsByDay(req.query.brand ? clean(req.query.brand, 20) : null))
    brandRow(p.date, p.brand).pallets += p.n
  // Historico de PalletScan (antes de VIOS): se suma por dia y modelo a lo de VIOS.
  const brandQ = req.query.brand ? clean(req.query.brand, 20) : null
  const history = await rows(sql`
    select date, model, sum(pieces)::int as pieces, sum(rejected)::int as rejected from production_history
    where ${brandQ ? sql`brand = ${brandQ}` : sql`true`} group by 1, 2`)
  for (const h of history) {
    const k = `${h.date}|${h.model}`
    dailyMap.set(k, (dailyMap.get(k) || 0) + h.pieces)
  }
  const historyBrand = await rows(sql`
    select date, model, brand, sum(pieces)::int as pieces, sum(rejected)::int as rejected from production_history
    where ${brandQ ? sql`brand = ${brandQ}` : sql`true`} group by 1, 2, 3`)
  for (const h of historyBrand) {
    brandRow(h.date, h.brand).pieces += h.pieces
    addSplit(h.date, h.model, h.brand, h.pieces)
  }
  const splitOf = (model, d = null) =>
    Object.fromEntries(
      BRANDS.map((b) => [
        b,
        [...splitMap]
          .filter(([k]) => {
            const [kd, km, kb] = k.split('|')
            return km === model && kb === b && (d === null || kd === d)
          })
          .reduce((a, [, n]) => a + n, 0),
      ]),
    )
  const daily = [...dailyMap].map(([k, n]) => {
    const [shift_date, model] = k.split('|')
    return { shift_date, model, n }
  })
  const modelOf = new Map(produced.map((x) => [x.serial, x.model]))
  const brandOfSerial = new Map(produced.map((x) => [x.serial, x.brand]))
  const rejectedSerials = await rows(sql`select distinct serial from rejections`)
  const rejectedIn = []
  // Rechazados por modelo y marca (2026-10-12: "abajo de cada modelo HY y lo procesado sin lo rechazado").
  const rejBrand = new Map()
  const addRej = (model, brand, n) => {
    const k = `${model}|${brand}`
    rejBrand.set(k, (rejBrand.get(k) || 0) + n)
  }
  for (const h of historyBrand) if (h.rejected) addRej(h.model, h.brand, h.rejected)
  for (const { serial } of rejectedSerials) {
    const m = modelOf.get(serial)
    if (!m) continue
    addRej(m, brandOfSerial.get(serial), 1)
    const row = rejectedIn.find((x) => x.model === m)
    if (row) row.n++
    else rejectedIn.push({ model: m, n: 1 })
  }
  for (const h of history) {
    if (!h.rejected) continue
    const row = rejectedIn.find((x) => x.model === h.model)
    if (row) row.n += h.rejected
    else rejectedIn.push({ model: h.model, n: h.rejected })
  }
  const palletModel = await palletsByDayModel(brandQ)
  const days = [...new Set(daily.map((x) => x.shift_date))].sort()
  const byDay = days.map((d) => {
    const row = { date: d, total: 0 }
    for (const m of allModels) {
      row[m.code] = daily.find((x) => x.shift_date === d && x.model === m.code)?.n || 0
      row.total += row[m.code]
    }
    row.split = Object.fromEntries(allModels.map((m) => [m.code, splitOf(m.code, d)]))
    row.palletSplit = Object.fromEntries(
      allModels.map((m) => [
        m.code,
        Object.fromEntries(
          BRANDS.map((b) => [
            b,
            palletModel
              .filter((x) => x.date === d && x.model === m.code && x.brand === b)
              .reduce((a, x) => a + x.n, 0),
          ]),
        ),
      ]),
    )
    row.brands = BRANDS.map((brand) => {
      const b = brandDay.get(`${d}|${brand}`)
      return { brand, pieces: b?.pieces || 0, pallets: b?.pallets || 0 }
    })
    return row
  })
  const modelsOut = allModels.map((m) => {
    const produced = daily.filter((x) => x.model === m.code).reduce((a, x) => a + x.n, 0)
    const rejected = rejectedIn.find((x) => x.model === m.code)?.n || 0
    const net = produced - rejected
    const target = m.targetMty + m.targetTexas
    return {
      code: m.code,
      active: m.active,
      produced,
      rejected,
      net,
      targetMty: m.targetMty,
      targetTexas: m.targetTexas,
      target,
      pct: target ? net / target : null,
      remaining: Math.max(0, target - net),
      brands: splitOf(m.code),
      rejectedBrands: Object.fromEntries(BRANDS.map((b) => [b, rejBrand.get(`${m.code}|${b}`) || 0])),
    }
  })
  const totals = byDay.map((x) => x.total)
  const sum = totals.reduce((a, x) => a + x, 0)
  // Proyeccion: regresion lineal de los ultimos 10 dias con produccion, topada a 2 turnos de meta.
  const projection = projectProduction(totals, capacity, todayPlant())
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
    history: {
      pieces: history.reduce((a, h) => a + h.pieces, 0),
      rejected: history.reduce((a, h) => a + h.rejected, 0),
      from: history.map((h) => h.date).sort()[0] || null,
      to:
        history
          .map((h) => h.date)
          .sort()
          .at(-1) || null,
    },
  })
})

// Personal por turno y productividad (piezas por persona).
// Personal y productividad por turno: piezas de salidas cerradas (sin linea) / personas del turno
// (suma de las lineas capturadas en Reportes -> Personal del turno).
r.get('/reports/staffing', requireAuth(), async (req, res) => {
  const { from, to } = range(req.query, 6)
  // Personas = areas de trabajo (Entrada, Produccion por linea, Salida) con escaneos en el turno, 1 por area.
  const brand = req.query.brand ? clean(req.query.brand, 20) : null
  const count = await outputByShift(from, to, brand)
  const activity = await areaActivity(from, to, brand)
  const keys = new Set([...Object.keys(activity), ...Object.keys(count)])
  const list = [...keys]
    .filter((k) => k.slice(0, 10) >= from && k.slice(0, 10) <= to)
    .sort()
    .map((k) => {
      const [shiftDate, shift] = k.split('|')
      const lines = WORK_AREAS.filter((a) => activity[k]?.[a.key] > 0).map((a) => ({
        line: a.label,
        people: 1,
        pieces: activity[k][a.key],
      }))
      const people = lines.length || null
      const produced = count[k] || 0
      return { shiftDate, shift, people, produced, perPerson: people ? produced / people : null, lines }
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
           s.created_at as salida_created_at, s.expected_item_count,
           (select count(*)::int from pallet_items si where si.pallet_id = s.id) as pieces_out,
           (select count(distinct si.code)::int from pallet_items si
              where si.pallet_id = s.id
                and exists (select 1 from pallet_items ei where ei.pallet_id = e.id and ei.code = si.code)) as valid_out,
           (select count(*)::int from pallet_items ei where ei.pallet_id = e.id) as live_in
    from pallets e
    left join pallets s on s.linked_pallet_id = e.id
    where e.type = 'entrada' and ${brandCond(req.query, sql`e.brand`)}
      and (
        (e.created_at at time zone 'America/Monterrey')::date between ${from}::date and ${to}::date
        -- 2026-10-08 (Roman): los pallets con su proceso sin terminar salen siempre, de cualquier dia, hasta
        -- cerrarse: entrada abierta, entrada sin salida o salida abierta.
        or e.status = 'abierto' or s.id is null or s.status = 'abierto'
      )
    order by e.created_at desc`)
  const out = list.map((x) => {
    let state = 'consolidado'
    if (x.entrada_status === 'abierto') state = 'escaneando'
    else if (!x.salida_id) state = 'sin_salida'
    else if (x.salida_status === 'abierto') state = 'en_proceso'
    else if (x.missing_count > 0) state = 'con_faltantes'
    const piecesIn = x.entrada_status === 'abierto' ? x.live_in : x.pieces_in
    // Progreso de salida (Progreso visual de pallets): piezas validas unicas de la salida (que estan en su
    // entrada) / piezas esperadas (las de la entrada). Entre 0 y 1; sin esperadas = 0.
    const expected = x.salida_id ? x.expected_item_count || x.live_in || piecesIn || 0 : piecesIn || 0
    const valid = x.salida_id ? Math.min(x.valid_out || 0, expected) : 0
    const day = String(x.created_at instanceof Date ? x.created_at.toISOString() : x.created_at)
    const createdDay = new Date(day).toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' })
    return {
      ...x,
      pieces_in: piecesIn,
      state,
      carried: createdDay < from,
      expected,
      valid_out: valid,
      progress: expected > 0 ? valid / expected : 0,
    }
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

// Inicio -> tocar HY o SILO (2026-10-12, Roman: "quiero ver que pallet es y sus teles... si trabajan en otro modelo
// verlo tambien, no todo junto"): piezas producidas del turno actual de esa marca, por modelo y por pallet, con sus
// series. Mismo conteo que la tarjeta (shiftOutput, una vez por serial, con ajustes).
r.get('/dashboard/brand', requireAuth(), async (req, res) => {
  const brand = clean(req.query.brand, 20)
  const { shiftDate, shift } = shiftOf()
  const list = (await shiftOutput(shiftDate, shift)).filter((x) => x.brand === brand)
  // Cada tele va con SU pallet aunque haya contado primero por el escaneo en linea (2026-10-12: "dice 21 en pallet
  // pero 6 en produccion y en el pallet dice 27"): su salida si tiene, si no su entrada.
  const codes = list.filter((x) => !String(x.serial).startsWith('AJUSTE-')).map((x) => x.serial)
  const where = codes.length
    ? await rows(sql`
        select distinct on (i.code) i.code, p.id, p.type, p.status, p.linked_pallet_id, p.brand
        from pallet_items i join pallets p on p.id = i.pallet_id
        where i.code in (${sql.join(
          codes.map((c) => sql`${c}`),
          sql`, `,
        )})
        order by i.code, (p.type = 'salida') desc, i.scanned_at desc`)
    : []
  const palletOf = new Map(where.map((w) => [w.code, w]))
  const models = new Map()
  for (const x of list) {
    const m = x.model || 'Sin modelo'
    if (!models.has(m)) models.set(m, new Map())
    const w = palletOf.get(x.serial)
    const key = String(x.serial).startsWith('AJUSTE-')
      ? '__ajuste'
      : w
        ? w.type === 'salida'
          ? w.linked_pallet_id
          : w.id
        : '__linea'
    const g = models.get(m)
    if (!g.has(key)) g.set(key, { pallet: w || null, items: [] })
    else if (w?.type === 'salida') g.get(key).pallet = w
    g.get(key).items.push({ serial: x.serial, at: x.at, viaLine: !x.pallet })
  }
  const out = [...models].map(([model, groups]) => ({
    model,
    pieces: [...groups.values()].reduce((a, v) => a + v.items.length, 0),
    groups: [...groups].map(([key, { pallet: w, items }]) => ({
      kind: key === '__linea' ? 'linea' : key === '__ajuste' ? 'ajuste' : 'pallet',
      palletId: w?.id || null,
      type: w?.type || null,
      entradaId: w ? (w.type === 'salida' ? w.linked_pallet_id : w.id) : null,
      status: w?.status || null,
      palletBrand: w?.brand || null,
      pieces: items.length,
      viaLine: items.filter((i) => i.viaLine).length,
      serials:
        key === '__ajuste'
          ? []
          : items.sort((a, b) => String(a.at).localeCompare(String(b.at))).map((i) => i.serial),
    })),
  }))
  out.sort((a, b) => b.pieces - a.pieces)
  res.json({ shiftDate, shift, brand, total: list.length, models: out })
})

// Inicio: resumen del turno actual.
r.get('/dashboard', requireAuth(), async (_req, res) => {
  const { shiftDate, shift } = shiftOf()
  // Mismo conteo y meta que Hora por Hora: piezas de salidas + registradas, meta del turno (765 por defecto).
  const output = await shiftOutput(shiftDate, shift)
  const produced = output.length
  const { goal } = await shiftGoal(shiftDate, shift)
  const [{ n: rejected }] = await rows(
    sql`select count(*)::int n from rejections where shift_date = ${shiftDate}`,
  )
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
    brands: await shiftBrandSplit(shiftDate, shift),
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
