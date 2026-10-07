import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, PageHeader } from '@/components/ui'
import { fmtYmd } from '@/lib/utils'
import { CHANGELOG } from './changelog'

const SECTIONS = [
  ['added', 'Nuevo', 'green'],
  ['changed', 'Cambios', 'blue'],
  ['fixed', 'Correcciones', 'amber'],
]

export default function Cambios() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink />}
        title="Historial de cambios"
        subtitle={`Versión actual ${CHANGELOG[0].version}`}
      />
      <div className="space-y-4">
        {CHANGELOG.map((r) => (
          <Card key={r.version} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-extrabold">v{r.version}</span>
              <span className="text-[13px] text-muted-foreground">{fmtYmd(r.date)} {r.date.slice(0, 4)}</span>
              {r.title && <Badge tone="violet">{r.title}</Badge>}
            </div>
            {SECTIONS.filter(([k]) => r[k]?.length).map(([k, label, tone]) => (
              <div key={k} className="mt-4">
                <Badge tone={tone}>{label}</Badge>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">
                  {r[k].map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}

export function BackLink() {
  return (
    <Link to="/ayuda" className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" /> Ayuda
    </Link>
  )
}
