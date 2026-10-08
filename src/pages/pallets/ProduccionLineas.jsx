// Produccion por linea (diseno de PalletScan). Arriba la estacion: Marca -> Modelo -> Linea y se escanea
// serial de TV + caja (deben coincidir). Abajo el avance por linea con su personal ("Editar personal").
// Estos escaneos tambien suman a la produccion del turno (Inicio / Hora x Hora), junto con las salidas cerradas.
import { shiftOf } from '@shared/shift.js'
import { Factory, Plus, ScanBarcode, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, Dialog, Empty, ErrorBox, Segmented, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi, useStored } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, fmtAgo, fmtInt, fmtYmd } from '@/lib/utils'
import { ShiftPicker } from '../produccion/common'
import { Chips, ScanStation } from '../produccion/Registro'
import { BackLink } from './shared'

const RANGE = { T1: '07:00 a.m. – 10:00 p.m.', T2: '10:00 p.m. – 07:00 a.m.' }
const fmt1 = (v) =>
  v === null || v === undefined ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 1 })

function StaffDialog({ open, onClose, sel, data, onSaved }) {
  const toast = useToast()
  const { lines } = useCatalogs()
  const [rows, setRows] = useState([])
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)

  // Al abrir: lineas con personal o produccion en el turno.
  useEffect(() => {
    if (!open) return
    setRows(
      data.lines
        .filter((l) => l.line)
        .map((l) => ({ line: l.line, people: l.people ? String(l.people) : '' })),
    )
    setAdd('')
  }, [open, data])

  const free = lines.filter((l) => !rows.some((r) => r.line === l.name))

  async function save() {
    setBusy(true)
    try {
      // Las lineas quitadas quedan en 0 personas.
      const body = Object.fromEntries(lines.map((l) => [l.name, 0]))
      for (const r of rows) body[r.line] = Number(r.people || 0)
      await api('/staffing', { method: 'PUT', body: { ...sel, lines: body } })
      toast('Personal guardado')
      onSaved()
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Personal del turno"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={save}>
            Guardar
          </Button>
        </>
      }
    >
      <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">
        {sel.shift === 'T1' ? 'Turno 1' : 'Turno 2'} · {fmtYmd(sel.shiftDate)}
      </p>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.line} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{r.line}</span>
              <input
                className="field h-11 w-24 text-right text-[16px] font-bold tabular"
                inputMode="numeric"
                placeholder="0"
                value={r.people}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                  setRows((rs) => rs.map((x, j) => (j === i ? { ...x, people: v } : x)))
                }}
                aria-label={`Personas en ${r.line}`}
              />
              <span className="text-[13px] text-muted-foreground">pers.</span>
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                aria-label={`Quitar ${r.line}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-center text-[14px] text-muted-foreground">
          Agrega las líneas activas en este turno
        </p>
      )}
      <div className="mt-4 flex gap-2 border-t pt-4">
        <select
          className="field h-11 flex-1"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          aria-label="Línea a agregar"
        >
          <option value="">{free.length ? 'Elige una línea…' : 'Todas las líneas ya están'}</option>
          {free.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!add}
          onClick={() => {
            setRows((rs) => [...rs, { line: add, people: '' }])
            setAdd('')
          }}
        >
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
    </Dialog>
  )
}

// Estacion: se elige en orden Marca -> Modelo -> Linea; despues se escanea TV + caja. Se recuerda en el equipo.
function Station({ onRegistered }) {
  const cat = useCatalogs()
  const [st, setSt] = useStored('vp:station', { line: '', model: '', brand: '' })
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
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Personas</dt>
          <dd className="tabular text-[17px] font-extrabold">{l.people ?? '—'}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Pzs/pers.</dt>
          <dd className="tabular text-[17px] font-extrabold text-emerald-700 dark:text-emerald-300">
            {fmt1(l.perPerson)}
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
  const [sel, setSel] = useState(shiftOf)
  const [brand, setBrand] = useState('')
  const [editing, setEditing] = useState(false)
  const { data, error, loading, reload } = useApi('/production/by-line', {
    query: { ...sel, brand },
    refreshMs: 20000,
  })
  const live = data && data.current.shiftDate === sel.shiftDate && data.current.shift === sel.shift
  const withLine = data?.lines.filter((l) => l.line) || []

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink />
          <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">Producción por línea</h1>
        </div>
        <ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={setSel} />
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={brand}
          onChange={setBrand}
          options={[
            { value: '', label: 'Todos' },
            { value: 'HY', label: 'HY' },
            { value: 'SILO', label: 'SILO' },
          ]}
        />
        {canDo(user, ['supervisor']) && data && (
          <Button onClick={() => setEditing(true)}>
            <Users className="h-4 w-4" /> Editar personal
          </Button>
        )}
      </div>

      {data && (
        <p className="text-[14.5px] text-muted-foreground">
          <b className="text-primary">{fmtInt(data.people)}</b> persona{data.people === 1 ? '' : 's'} ·{' '}
          <b className="text-primary">{fmtInt(withLine.length)}</b> línea{withLine.length === 1 ? '' : 's'}{' '}
          registrada
          {withLine.length === 1 ? '' : 's'} · <b className="text-foreground">{fmtInt(data.total)}</b> pieza
          {data.total === 1 ? '' : 's'} en el turno
        </p>
      )}

      {canDo(user, ['supervisor', 'operador']) && <Station onRegistered={() => reload(true)} />}

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data && !data.lines.length ? (
        <Card>
          <Empty icon={Factory} title="Sin líneas activas en este turno">
            Aparecerán aquí en cuanto se escanee producción en una línea o se capture el personal.
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

      {data && (
        <StaffDialog
          open={editing}
          onClose={() => setEditing(false)}
          sel={sel}
          data={data}
          onSaved={() => reload(true)}
        />
      )}
    </div>
  )
}
