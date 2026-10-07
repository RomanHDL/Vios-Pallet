// Tarjeta grande de acceso (paginas "hub" como Pallets, Produccion, Reportes).
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TONES = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  navy: 'bg-accent text-accent-foreground',
}

// Toda la tarjeta es el enlace (en PalletScan solo la flecha respondia al clic).
export function MenuCard({ to, icon: Icon, title, description, tone = 'navy', badge, className }) {
  return (
    <Link
      to={to}
      className={cn(
        'card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-5',
        className,
      )}
    >
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', TONES[tone])}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold leading-tight">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>}
      </span>
      {badge}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </Link>
  )
}
