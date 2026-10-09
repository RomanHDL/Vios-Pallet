// Produccion por linea (diseno de PalletScan). Al abrir, primero se elige Marca -> Modelo -> Linea; ya completo,
// sale la estacion para escanear serial de TV + caja (deben coincidir) y abajo el avance por linea.
// 2026-10-09: sin "Editar personal" ni filtro de marca (el personal ya es automatico: 1 por area).
// Estos escaneos tambien suman a la produccion del turno (Inicio / Hora x Hora), junto con las salidas cerradas.
import { shiftOf } from '@shared/shift.js'
import { Factory, History, ScanBarcode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, Empty, ErrorBox, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, fmtAgo, fmtInt, fmtYmd } from '@/lib/utils'
import { ShiftPicker } from '../produccion/common'
import { Chips, ScanStation } from '../produccion/Registro'
import { BackLink } from './shared'

const RANGE = { T1: '07:00 a.m. – 10:00 p.m.', T2: '10:00 p.m. – 07:00 a.m.' }
const fmt1 = (v) =>
  v === null || v === undefined ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 1 })

// Al abrir la pantalla la seleccion empieza vacia: primero se llena Marca, Modelo y Linea.
export const EMPTY_STATION = { line: '', model: '', brand: '' }

function Station({ st, setSt, onRegistered }) {
  const cat = useCatalogs()
  const [open, setOpen] = useState(true)
  const brand = cat.brands.some((b) => b.code === st?.brand) ? st.brand : ''
  const model = cat.models.find((m) => m.code === st?.model)
  const line = cat.lines.some((l) => l.name === st?.line) ? st.line : ''
  const ready = Boolean(brand && model && line)
  const set = (k) => (v) =>
    setSt((x) => {
      const n = { ...x, [k]: v }
      // Cambiar un paso anterior pide volver a elegir los siguientes.
      if (k === 'brand') Object.assign(n, { model: '', line: '' })
      if (k === 'model') n.line = ''
      return n
    })

  if (!cat.loaded) return null
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
          <ScanBarcode className="h-5 w-5 text-primary" /> Registrar producción
        </h2>
        {ready && (
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
            <span className="rounded-lg bg-muted px-2.5 py-1">{brand}</span>
            <span className="rounded-lg bg-muted px-2.5 py-1">{model.code}</span>
            <span className="rounded-lg bg-primary px-2.5 py-1 text-primary-foreground">{line}</span>
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? 'Cambiar' : 'Ocultar'}
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {(!ready || !open) && (
          <>
            <Chips
              label="1. Marca"
              value={brand}
              onChange={set('brand')}
              options={cat.brands.map((b) => ({ value: b.code, label: b.code }))}
            />
            {brand && (
              <Chips
                label="2. Modelo"
                value={model?.code || ''}
                onChange={set('model')}
                options={cat.models.map((m) => ({
                  value: m.code,
                  label: m.code,
                  hint: `Serial ${m.prefix}…`,
                }))}
              />
            )}
            {brand && model && (
              <Chips
                label="3. Línea"
                value={line}
                onChange={(v) => {
                  set('line')(v)
                  setOpen(true)
                }}
                options={cat.lines.map((l) => ({ value: l.name, label: l.name }))}
              />
            )}
          </>
        )}
        {ready && open && (
          <ScanStation
            station={{ brand, model: model.code, line }}
            prefix={model.prefix}
            onRegistered={onRegistered}
          />
        )}
      </div>
    </Card>
  )
}

function LineCard({ l, total }) {
  const share = total ? l.pieces / total : 0
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn('truncate text-[17px] font-extrabold', !l.line && 'text-muted-foreground')}>
          {l.line || 'Sin línea'}
        </h3>
        <span className="text-[12.5px] font-semibold text-muted-foreground">
          {l.models} modelo{l.models === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="tabular text-[44px] font-extrabold leading-none tracking-tight text-navy dark:text-foreground">
          {fmtInt(l.pieces)}
        </span>
        <span className="pb-1 text-[14px] text-muted-foreground">piezas</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Del turno</dt>
          <dd className="tabular text-[17px] font-extrabold text-emerald-700 dark:text-emerald-300">
            {fmt1(share * 100)}%
          </dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Último</dt>
          <dd className="truncate text-[13px] font-bold">{l.lastAt ? fmtAgo(l.lastAt) : '—'}</dd>
        </div>
      </dl>
    </Card>
  )
}

export default function ProduccionLineas() {
  const { user } = useSession()
  const cat = useCatalogs()
  const isAdmin = user?.role === 'admin'
  const [sel, setSel] = useState(shiftOf)
  // El area de la linea siempre ve el turno en curso: a las 7:00 am (Turno 1) y 10:00 pm (Turno 2) la pantalla
  // cambia sola y arranca en 0. Las piezas no se borran: quedan guardadas con su fecha y turno (historial admin).
  useEffect(() => {
    if (isAdmin) return
    const tick = () =>
      setSel((cur) => {
        const now = shiftOf()
        return now.shiftDate === cur.shiftDate && now.shift === cur.shift ? cur : now
      })
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [isAdmin])
  const [st, setSt] = useState(EMPTY_STATION)
  const { data, error, loading, reload } = useApi('/production/by-line', {
    query: { ...sel },
    refreshMs: 20000,
  })
  const canScan = canDo(user, ['supervisor', 'operador'])
  // Mientras no se elija Marca, Modelo y Linea solo se ve la estacion (lo primero que se llena).
  const ready = Boolean(
    cat.brands.some((b) => b.code === st.brand) &&
      cat.models.some((m) => m.code === st.model) &&
      cat.lines.some((l) => l.name === st.line),
  )
  const showRest = !canScan || ready || isAdmin
  const live = data && data.current.shiftDate === sel.shiftDate && data.current.shift === sel.shift
  const withLine = data?.lines.filter((l) => l.line) || []

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink />
          <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">Producción por línea</h1>
        </div>
        {isAdmin && <ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={setSel} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-white/15 px-3 py-1 text-[14px] font-bold">
            {sel.shift === 'T1' ? 'Turno 1' : 'Turno 2'}
          </span>
          <span className="text-[18px] font-extrabold">{fmtYmd(sel.shiftDate, { dow: false })}</span>
        </div>
        <span className="flex items-center gap-2 text-[13.5px] text-white/75">
          {RANGE[sel.shift]}
          <span
            className={cn('h-2.5 w-2.5 rounded-full', live ? 'bg-emerald-400' : 'bg-white/30')}
            title={live ? 'Turno en curso' : 'Turno fuera de horario'}
          />
        </span>
      </div>

      {canScan && <Station st={st} setSt={setSt} onRegistered={() => reload(true)} />}

      {showRest && data && (
        <p className="text-[14.5px] text-muted-foreground">
          <b className="text-primary">{fmtInt(withLine.length)}</b> línea{withLine.length === 1 ? '' : 's'} registrada
          {withLine.length === 1 ? '' : 's'} · <b className="text-foreground">{fmtInt(data.total)}</b> pieza
          {data.total === 1 ? '' : 's'} en el turno
        </p>
      )}

      <ErrorBox error={error} />

      {!showRest ? null : loading && !data ? (
        <Spinner />
      ) : data && !data.lines.length ? (
        <Card>
          <Empty icon={Factory} title="Sin líneas activas en este turno">
            Aparecerán aquí en cuanto se escanee producción en una línea.
          </Empty>
        </Card>
      ) : (
        data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.lines.map((l) => (
              <LineCard key={l.line || '-'} l={l} total={data.total} />
            ))}
          </div>
        )
      )}

      {isAdmin && <DayHistory onPick={setSel} />}
    </div>
  )
}

// Historial dia por dia (solo admin): piezas por turno y linea. Tocar un turno lo abre arriba.
function DayHistory({ onPick }) {
  const { data, error } = useApi('/production/history', { query: { days: 30 }, refreshMs: 60000 })
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
          <History className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-[16px] font-extrabold leading-tight">Historial día por día</h3>
          <p className="text-[12.5px] text-muted-foreground">Piezas escaneadas por turno y línea · últimos 30 días</p>
        </div>
      </div>
      <ErrorBox error={error} className="m-4" />
      {!data ? (
        <Spinner />
      ) : !data.shifts.length ? (
        <Empty icon={History} title="Sin producción por línea en los últimos 30 días" />
      ) : (
        <ul className="divide-y">
          {data.shifts.map((s) => (
            <li key={`${s.shiftDate}|${s.shift}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ shiftDate: s.shiftDate, shift: s.shift })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 sm:grid-cols-[150px_90px_minmax(0,1fr)_auto] sm:px-5"
              >
                <span className="font-bold">{fmtYmd(s.shiftDate)}</span>
                <span className="hidden text-[13px] font-semibold text-muted-foreground sm:block">
                  {s.shift === 'T1' ? 'Turno 1' : 'Turno 2'}
                </span>
                <span className="col-span-2 row-start-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:row-start-auto">
                  {s.lines.map((l) => (
                    <span key={l.line} className="rounded-lg bg-muted px-2 py-0.5 text-[12.5px] font-semibold">
                      {l.line} <b className="tabular">{fmtInt(l.pieces)}</b>
                    </span>
                  ))}
                </span>
                <span className="tabular row-start-1 text-right text-[18px] font-extrabold sm:row-start-auto">
                  {fmtInt(s.total)} <span className="text-[12px] font-medium text-muted-foreground">pzs</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
