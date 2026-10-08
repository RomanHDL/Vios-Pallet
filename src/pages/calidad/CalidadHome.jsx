import { addDays, shiftOf, todayPlant } from '@shared/shift.js'
import { AlertOctagon, ClipboardCheck, Factory, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  ErrorBox,
  PageHeader,
  Segmented,
  Spinner,
  Stat,
  useToast,
} from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, fmtDateTime, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'
import { BackLink, defectList } from '../produccion/common'

const RANGES = [
  { value: 1, label: 'Hoy' },
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 0, label: 'Todo' },
]

export default function CalidadHome() {
  const { user } = useSession()
  const toast = useToast()
  const [days, setDays] = useState(1)
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Rango por fecha de turno: el Turno 2 despues de medianoche sigue contando como "hoy".
  const to = todayPlant()
  const from =
    days === 0 ? undefined : addDays(days === 1 ? shiftOf().shiftDate : to, days === 1 ? 0 : -(days - 1))
  const { data, error, loading, reload } = useApi('/rejections', { query: { from, to }, refreshMs: 60000 })

  const list = useMemo(
    () => (data?.rejections || []).map((r) => ({ ...r, defects: defectList(r.defects) })),
    [data],
  )
  const ranking = useMemo(() => {
    const by = {}
    for (const r of list) for (const d of r.defects) by[d] = (by[d] || 0) + 1
    return Object.entries(by)
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n)
  }, [list])
  const inProd = list.filter((r) => r.in_production).length
  const top = ranking[0]

  const s = search.trim().toUpperCase()
  const shown = s
    ? list.filter(
        (r) =>
          r.serial.includes(s) ||
          r.defects.some((d) => d.toUpperCase().includes(s)) ||
          String(r.model || '')
            .toUpperCase()
            .includes(s),
      )
    : list

  const canAdd = canDo(user, ['calidad', 'supervisor'])
  const canDelete = canDo(user, ['supervisor'])

  const remove = async () => {
    setDeleting(true)
    try {
      await api(`/rejections/${toDelete.id}`, { method: 'DELETE' })
      toast('Rechazo eliminado')
      setToDelete(null)
      reload(true)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/">Inicio</BackLink>}
        title="Calidad"
        subtitle={
          days === 0
            ? 'Todos los rechazos (incluye el histórico de la hoja MTY - VIOS/HY)'
            : days === 1
              ? `Rechazos de hoy · ${fmtYmd(from)}`
              : `Rechazos del ${fmtYmd(from)} al ${fmtYmd(to)}`
        }
        actions={
          <>
            <Segmented value={days} onChange={setDays} options={RANGES} />
            {canAdd && (
              <Link
                to="/calidad/nuevo"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Plus className="h-[18px] w-[18px]" /> Nuevo rechazo
              </Link>
            )}
          </>
        }
      />

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              label="Rechazos"
              value={fmtInt(list.length)}
              icon={ClipboardCheck}
              tone={list.length ? 'red' : 'default'}
              hint={`${fmtInt(new Set(list.map((r) => r.serial)).size)} seriales`}
            />
            <Stat
              label="En producción"
              value={fmtInt(inProd)}
              icon={Factory}
              tone={inProd ? 'amber' : 'default'}
              hint={
                list.length
                  ? `${fmtPct(inProd / list.length)} ya registrados`
                  : 'Ya registrados como terminados'
              }
            />
            <Stat
              label="Defecto principal"
              value={top ? fmtInt(top.n) : '—'}
              icon={AlertOctagon}
              tone="violet"
              hint={top ? top.name : 'Sin rechazos'}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <Card className="self-start">
              <CardHeader icon={Tag} title="Defectos" subtitle="Veces reportado en el periodo" />
              {ranking.length ? (
                <ul className="space-y-3 p-4 sm:p-5">
                  {ranking.map((d) => (
                    <li key={d.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13.5px]">
                        <span className="min-w-0 truncate font-semibold">{d.name}</span>
                        <span className="tabular shrink-0 font-bold">
                          {fmtInt(d.n)}{' '}
                          <span className="font-medium text-muted-foreground">
                            · {fmtPct(d.n / list.length)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-500"
                          style={{ width: `${(d.n / ranking[0].n) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Sin defectos en el periodo" />
              )}
            </Card>

            <Card>
              <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
                <h3 className="text-[15px] font-bold">Rechazos</h3>
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Serial, modelo o defecto"
                    className="field h-10 pl-9 text-[14px]"
                  />
                </div>
              </div>
              {shown.length ? (
                <ul className="max-h-[70dvh] divide-y overflow-y-auto">
                  {shown.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all font-mono text-[14.5px] font-bold">{r.serial}</span>
                          {r.in_production && (
                            <Badge tone="amber" dot>
                              En producción
                            </Badge>
                          )}
                          {r.source === 'historico' && <Badge tone="gray">Histórico</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.defects.map((d) => (
                            <Badge key={d} tone="red">
                              {d}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                          {[r.model, r.brand, r.pallet_id && `Pallet ${r.pallet_id}`]
                            .filter(Boolean)
                            .join(' · ') || 'Sin datos de pallet'}
                        </p>
                        {r.comments && (
                          <p className="mt-1 text-[13px] italic text-foreground/80">“{r.comments}”</p>
                        )}
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {r.source === 'historico' ? 'Hoja MTY - VIOS/HY' : r.registered_by_name || '—'} ·{' '}
                          {r.source === 'historico'
                            ? fmtYmd(r.shift_date)
                            : `${fmtDateTime(r.registered_at)} · ${r.shift}`}
                        </p>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(r)}
                          aria-label="Eliminar rechazo"
                        >
                          <Trash2 className="h-[18px] w-[18px] text-red-600" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={ClipboardCheck} title={s ? 'Sin coincidencias' : 'Sin rechazos en el periodo'}>
                  {!s && canAdd && 'Registra uno con “Nuevo rechazo”.'}
                </Empty>
              )}
            </Card>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title="Eliminar rechazo"
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </>
        }
      >
        {toDelete && (
          <div className="space-y-2 text-[14px]">
            <p>Se eliminará el rechazo del serial:</p>
            <p className="rounded-xl bg-muted px-3 py-2 font-mono text-[15px] font-bold">{toDelete.serial}</p>
            <p className="text-muted-foreground">{toDelete.defects.join(', ')}</p>
            <p className="text-[13px] text-muted-foreground">
              Si no tiene otros rechazos, el serial podrá registrarse en producción.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
