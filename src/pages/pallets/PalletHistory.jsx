import { ChevronRight, History, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, todayPlant } from '@shared/shift.js'
import { Badge, Card, Empty, ErrorBox, Field, Input, PageHeader, Segmented, Spinner, Table, Td, Th } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { fmtDateTime, fmtInt } from '@/lib/utils'
import { BackLink, StatusBadge, TypeBadge, normPallet, useDebounced } from './shared'

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'salida', label: 'Salida' },
  { value: 'faltantes', label: 'Con faltantes' },
]

export default function PalletHistory() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('todos')
  const [from, setFrom] = useState(() => addDays(todayPlant(), -6))
  const [to, setTo] = useState(() => todayPlant())
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 350)

  const query = {
    type: filter === 'entrada' || filter === 'salida' ? filter : filter === 'faltantes' ? 'salida' : undefined,
    missing: filter === 'faltantes' ? '1' : undefined,
    from,
    to,
    q: dq,
  }
  const { data, error, loading } = useApi('/pallets', { query })
  const list = (data?.pallets || []).map(normPallet)
  const open = (p) => navigate(`/pallets/${p.id}`)

  return (
    <div>
      <PageHeader back={<BackLink />} title="Historial de pallets" subtitle="Entradas y salidas registradas" />

      <Card className="mb-4 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
          <div>
            <span className="label">Tipo</span>
            <Segmented value={filter} onChange={setFilter} options={FILTERS} className="w-full sm:w-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
            <Field label="Desde">
              <Input type="date" className="min-w-0" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" className="min-w-0" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Buscar ID" className="col-span-2 sm:col-span-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  className="pl-9 font-mono"
                  autoComplete="off"
                />
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <span className="text-[14px] font-bold">Resultados</span>
          <span className="tabular text-[13px] text-muted-foreground">
            {data ? `${fmtInt(list.length)} pallet${list.length === 1 ? '' : 's'}` : ''}
          </span>
        </div>
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} className="m-4" />
        ) : !list.length ? (
          <Empty icon={History} title="Sin pallets en este periodo">
            Cambia el rango de fechas o los filtros.
          </Empty>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="hidden sm:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Pallet</Th>
                    <Th>Tipo</Th>
                    <Th>Estado</Th>
                    <Th>Modelo · Marca</Th>
                    <Th className="text-right">Piezas</Th>
                    <Th className="text-right">Faltan / Extra</Th>
                    <Th>Creado</Th>
                    <Th>Cerrado</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} onClick={() => open(p)} className="cursor-pointer hover:bg-muted/50">
                      <Td>
                        <Link to={`/pallets/${p.id}`} className="font-mono font-bold hover:text-primary" onClick={(e) => e.stopPropagation()}>
                          {p.id}
                        </Link>
                      </Td>
                      <Td>
                        <TypeBadge type={p.type} />
                      </Td>
                      <Td>
                        <StatusBadge status={p.status} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        {p.model} · {p.brand}
                      </Td>
                      <Td className="tabular text-right font-semibold">
                        <Pieces p={p} />
                      </Td>
                      <Td className="text-right">
                        <Discrepancy p={p} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div>{fmtDateTime(p.createdAt)}</div>
                        <div className="text-[12px] text-muted-foreground">{p.createdByName || '—'}</div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div>{fmtDateTime(p.closedAt)}</div>
                        <div className="text-[12px] text-muted-foreground">{p.closedByName || ''}</div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <ul className="divide-y sm:hidden">
              {list.map((p) => (
                <li key={p.id}>
                  <Link to={`/pallets/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/60">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 font-mono text-[16px] font-bold">{p.id}</span>
                        <TypeBadge type={p.type} />
                        <StatusBadge status={p.status} />
                      </span>
                      <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                        {p.model} · {p.brand} · {p.createdByName || '—'}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        {fmtDateTime(p.createdAt)}
                        <Discrepancy p={p} />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block text-[18px] font-extrabold leading-none">
                        <Pieces p={p} />
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">piezas</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}

function Pieces({ p }) {
  return (
    <>
      {fmtInt(p.liveCount)}
      {p.type === 'salida' && p.expected != null && <span className="text-[12px] font-semibold text-muted-foreground"> / {fmtInt(p.expected)}</span>}
    </>
  )
}

function Discrepancy({ p }) {
  if (p.type !== 'salida' || p.status !== 'cerrado') return <span className="text-muted-foreground">—</span>
  if (!p.missingCount && !p.extrasCount) return <Badge tone="green">Completo</Badge>
  return (
    <span className="inline-flex gap-1">
      {p.missingCount > 0 && <Badge tone="red">-{p.missingCount}</Badge>}
      {p.extrasCount > 0 && <Badge tone="amber">+{p.extrasCount}</Badge>}
    </span>
  )
}
