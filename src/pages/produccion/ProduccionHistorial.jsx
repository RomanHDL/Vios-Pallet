import { History, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { shiftLabel, shiftOf } from '@shared/shift.js'
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, Table, Td, Th, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, fmtDateTime, fmtInt, fmtYmd } from '@/lib/utils'
import { BackLink, SHIFT_OPTIONS } from './common'

const LIMIT = 300

export default function ProduccionHistorial() {
  const { user } = useSession()
  const { lines } = useCatalogs()
  const toast = useToast()
  const canDelete = canDo(user, ['supervisor'])

  const [f, setF] = useState(() => ({ shiftDate: shiftOf().shiftDate, shift: '', line: '', q: '' }))
  const [q, setQ] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  // Busqueda de serial con pequeno retraso para no consultar en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setF((x) => ({ ...x, q: q.trim() })), 350)
    return () => clearTimeout(id)
  }, [q])

  const { data, error, loading, reload } = useApi('/production', { query: { ...f, limit: LIMIT } })
  const records = data?.records || []

  const remove = async () => {
    setDeleting(true)
    try {
      await api(`/production/${toDelete.id}`, { method: 'DELETE' })
      toast('Registro eliminado')
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
      <PageHeader back={<BackLink to="/produccion">Producción</BackLink>} title="Historial de producción" subtitle="Seriales de producto terminado registrados" />

      <Card className="grid grid-cols-2 gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
        <Field label="Fecha de turno">
          <Input type="date" value={f.shiftDate} onChange={set('shiftDate')} />
        </Field>
        <Field label="Turno">
          <Select value={f.shift} onChange={set('shift')}>
            <option value="">Ambos</option>
            {SHIFT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Línea" className="col-span-2 sm:col-span-1">
          <Select value={f.line} onChange={set('line')}>
            <option value="">Todas</option>
            {lines.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Serial" className="col-span-2 sm:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serial…" className="pl-10 font-mono uppercase placeholder:font-sans placeholder:normal-case" />
          </div>
        </Field>
        <p className="col-span-2 text-[12px] text-muted-foreground lg:col-span-4">
          Deja la fecha vacía para buscar en todos los días.
        </p>
      </Card>

      <ErrorBox error={error} />

      <Card>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <span className="text-[14px] font-bold">
            {loading && !data ? 'Cargando…' : `${fmtInt(records.length)} registro${records.length === 1 ? '' : 's'}`}
          </span>
          {records.length >= LIMIT && <Badge tone="amber">Se muestran los {LIMIT} más recientes</Badge>}
        </div>
        {loading && !data ? (
          <Spinner />
        ) : !records.length ? (
          <Empty icon={History} title="Sin registros">
            Cambia los filtros para ver otros turnos.
          </Empty>
        ) : (
          <>
            {/* PC */}
            <Table className="hidden md:block">
              <thead>
                <tr>
                  <Th>Serial</Th>
                  <Th>Línea</Th>
                  <Th>Modelo</Th>
                  <Th>Marca</Th>
                  <Th>Turno</Th>
                  <Th>Registró</Th>
                  <Th>Fecha y hora</Th>
                  {canDelete && <Th className="text-right">Acción</Th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <Td className="font-mono font-semibold">{r.serial}</Td>
                    <Td className="font-semibold">{r.line}</Td>
                    <Td>{r.model}</Td>
                    <Td>
                      <Badge tone="blue">{r.brand}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {fmtYmd(r.shift_date)} · {r.shift}
                    </Td>
                    <Td>{r.registered_by_name || '—'}</Td>
                    <Td className="tabular whitespace-nowrap">{fmtDateTime(r.registered_at)}</Td>
                    {canDelete && (
                      <Td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(r)} aria-label="Eliminar registro">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Celular */}
            <ul className="divide-y md:hidden">
              {records.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[14.5px] font-bold">{r.serial}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="gray">Línea {r.line}</Badge>
                      <Badge tone="blue">{r.brand}</Badge>
                      <span className="text-[12.5px] font-semibold">{r.model}</span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-muted-foreground">
                      {fmtDateTime(r.registered_at)} · {shiftLabel(r.shift)} · {r.registered_by_name || '—'}
                    </p>
                  </div>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(r)} aria-label="Eliminar registro">
                      <Trash2 className="h-[18px] w-[18px] text-red-600" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Dialog
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title="Eliminar registro"
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
            <p>Se eliminará el registro de producción del serial:</p>
            <p className="rounded-xl bg-muted px-3 py-2 font-mono text-[15px] font-bold">{toDelete.serial}</p>
            <p className="text-muted-foreground">
              Línea {toDelete.line} · {toDelete.model} · {fmtDateTime(toDelete.registered_at)} · {toDelete.registered_by_name || '—'}
            </p>
            <p className="text-[13px] text-muted-foreground">El serial podrá volver a registrarse. Esta acción no se puede deshacer.</p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
