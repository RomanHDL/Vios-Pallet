// Reporte de SALIDA de pallet para imprimir (hoja vertical). Solo existe para salidas cerradas con fecha y
// hora de salida: el servidor lo valida en /api/pallets/:id/report (exitReportBlock) y esta pagina no genera
// el formato si la respuesta no es valida, aunque se entre directo por la URL.
import { PLANT_TZ } from '@shared/shift.js'
import { AlertTriangle, ArrowLeft, CheckCircle2, Package, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Spinner } from '@/components/ui'
import { api } from '@/lib/api'

const dateFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: PLANT_TZ,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: PLANT_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const fDate = (iso) => dateFmt.format(new Date(iso))
const fTime = (iso) => timeFmt.format(new Date(iso))
const fBoth = (iso) => `${fDate(iso)}, ${fTime(iso)}`

// Reparte la lista en 3 columnas de arriba a abajo (1..n en la primera, luego la segunda...).
function threeColumns(list) {
  const per = Math.max(1, Math.ceil(list.length / 3))
  return [0, 1, 2].map((c) => list.slice(c * per, (c + 1) * per).map((v, i) => ({ n: c * per + i + 1, v })))
}

function Row({ label, children, w }) {
  return (
    <div className="grid gap-3 py-[2px]" style={{ gridTemplateColumns: `${w} 1fr` }}>
      <dt className="whitespace-nowrap font-bold text-[#0f2a52]">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

function SerialColumns({ list, extras, different }) {
  return (
    <div className="grid grid-cols-3 items-start gap-0 divide-x divide-slate-300">
      {threeColumns(list).map((col, ci) => (
        <table key={ci} className="w-full table-fixed border-collapse px-2 text-[9pt] leading-[1.25]">
          <thead>
            <tr className="bg-[#e8eef7] text-[#0f2a52]">
              <th className="w-[2.6em] py-[3px] text-center font-bold">#</th>
              <th className="py-[3px] pl-2 text-left font-bold">Número de serie</th>
            </tr>
          </thead>
          <tbody>
            {col.map(({ n, v }) => (
              <tr key={n} className="even:bg-[#f3f6fb]">
                <td className="py-[2.5px] text-center font-bold tabular-nums">{n}</td>
                <td className="truncate py-[2.5px] pl-2 tabular-nums">
                  {v}
                  {extras.has(v) && (
                    <span className="ml-1 font-sans text-[7pt] font-bold uppercase">extra</span>
                  )}
                  {different.has(v) && (
                    <span className="ml-1 font-sans text-[7pt] font-bold uppercase">dif.</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

export default function ReporteSalida() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    api(`/pallets/${encodeURIComponent(id)}/report`)
      .then((data) => alive && setState({ data }))
      .catch((error) => alive && setState({ error }))
    return () => {
      alive = false
    }
  }, [id])

  if (state.loading) return <Spinner className="min-h-dvh" />

  // Sin salida valida: no se genera el formato; mensaje claro y regreso al detalle del pallet.
  if (state.error)
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-[20px] font-extrabold">Reporte de salida no disponible</h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">{state.error.message}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Disponible al registrar la salida del pallet.
          </p>
          <Link
            to={`/pallets/${encodeURIComponent(id)}`}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14.5px] font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al pallet
          </Link>
        </div>
      </div>
    )

  const { pallet: p, entrada, items, expected, missing } = state.data
  const extras = new Set(state.data.extras)
  const different = new Set(state.data.different || [])
  const complete = missing.length === 0
  const shownId = p.id.replace(/-S$/, '')

  return (
    <div className="exit-report min-h-dvh bg-slate-200 py-6 print:bg-white print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print mx-auto mb-4 flex w-full max-w-[8.5in] items-center justify-between gap-3 px-4">
        <Link
          to={`/pallets/${encodeURIComponent(p.id)}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al pallet
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir reporte
        </Button>
      </div>

      {/* Hoja */}
      <article className="sheet mx-auto w-full max-w-[8.5in] bg-white px-[0.55in] py-[0.5in] text-[9.5pt] text-slate-900 shadow-md print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center justify-between border-b-[3px] border-[#0f2a52] pb-3">
          <img src="/mi-technologies.png" alt="MI Technologies, Inc." className="h-[0.6in] w-auto" />
          <div className="text-right leading-tight">
            <p className="text-[12.5pt] font-extrabold tracking-wide text-[#0f2a52]">
              VIOS PALLET <span className="font-semibold text-slate-600">· MI TECHNOLOGIES MTY</span>
            </p>
            <p className="mt-0.5 text-[10pt] font-medium tracking-wide text-slate-600">REPORTE DE PALLET</p>
          </div>
        </header>

        <section className="mt-4 flex items-start justify-between gap-4">
          <h1 className="text-[34pt] font-extrabold leading-none tracking-tight">
            Salida <span className="text-[#0f2a52]">{shownId}</span>
          </h1>
          <div className="min-w-[2.3in] rounded-md border border-slate-300 bg-[#f6f8fc] px-3.5 py-2">
            <p className="border-b border-slate-300 pb-1 text-[11pt] font-bold text-slate-700">
              Estado: <span className="text-[14pt] text-[#0f2a52]">Cerrado</span>
            </p>
            <p className="mt-1">
              <span className="inline-block w-[3.2em] text-slate-600">Fecha:</span> <b>{fDate(p.closedAt)}</b>
            </p>
            <p>
              <span className="inline-block w-[3.2em] text-slate-600">Hora:</span> <b>{fTime(p.closedAt)}</b>
            </p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-5 rounded-md border border-slate-300 px-4 py-3">
          <dl>
            <Row w="6.2em" label="ID Pallet:">
              {p.id}
            </Row>
            <Row w="6.2em" label="Modelo:">
              {p.model || '—'}
            </Row>
            <Row w="6.2em" label="Marca:">
              {p.brand || '—'}
            </Row>
          </dl>
          <dl className="border-l border-slate-300 pl-5">
            <Row w="13em" label="Fecha y hora de entrada:">
              {fBoth(entrada.createdAt)}
            </Row>
            <Row w="13em" label="Fecha y hora de salida:">
              {fBoth(p.closedAt)}
            </Row>
            <Row w="13em" label="Pallet Entrada:">
              {entrada.id}
            </Row>
            <Row w="13em" label="Items escaneados:">
              {items.length} / {expected}
            </Row>
            <Row w="13em" label="Items faltantes:">
              {missing.length} — {complete ? 'Completo' : 'Incompleto'}
            </Row>
          </dl>
        </section>

        <section className="mt-4 overflow-hidden rounded-md border border-slate-300">
          <h2 className="flex items-center justify-between bg-[#0f2a52] px-4 py-1.5 text-[11.5pt] font-bold tracking-wide text-white">
            ITEMS ESCANEADOS ({items.length})
            <Package className="h-5 w-5" />
          </h2>
          <div className="px-2 py-2">
            {items.length ? (
              <SerialColumns list={items} extras={extras} different={different} />
            ) : (
              <p className="px-2 py-2 text-slate-600">Sin items escaneados.</p>
            )}
          </div>
        </section>

        <section className="mt-3 break-inside-avoid rounded-md border border-slate-300 px-4 py-2.5">
          <h2 className="text-[11pt] font-bold text-[#0f2a52]">ITEMS FALTANTES</h2>
          {complete ? (
            <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Sin faltantes — pallet completo
            </p>
          ) : (
            <>
              <p className="mt-0.5 flex items-center gap-1.5 font-bold text-red-700">
                <AlertTriangle className="h-4 w-4" /> Faltan {missing.length} de {expected} piezas
              </p>
              <ol className="mt-1 grid grid-cols-2 gap-x-6 text-[8.6pt]">
                {missing.map((m, i) => (
                  <li key={m.code} className="truncate">
                    <b className="tabular-nums">{i + 1}.</b> <span className="tabular-nums">{m.code}</span> —{' '}
                    {m.reason || 'Sin motivo'}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section className="mt-4 break-inside-avoid border-t-2 border-[#0f2a52] pt-2">
          <h2 className="text-[11pt] font-bold text-[#0f2a52]">FIRMAS DE AUTORIZACIÓN</h2>
          <div className="mt-2 grid grid-cols-3 gap-4">
            {['Calidad', 'Producción', 'Almacén'].map((a) => (
              <div key={a} className="overflow-hidden rounded-md border border-slate-300 text-center">
                <p className="bg-[#eef2f8] py-1 text-[11pt] font-bold text-[#0f2a52]">{a}</p>
                <div className="mx-4 mt-10 border-b border-slate-800" />
                <p className="pb-2 pt-1 text-[8.5pt] text-slate-600">Nombre y firma</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  )
}
