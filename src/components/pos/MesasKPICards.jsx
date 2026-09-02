import { useMesasKPIs } from '../../hooks/useMesasKPIs'
import { Table2, Users, CircleDollarSign, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const KPI_CONFIG = [
  {
    key: 'total',
    label: 'Total mesas',
    featured: true,
    icon: Table2,
  },
  {
    key: 'ocupadas',
    label: 'Ocupadas',
    valueClass: 'text-[hsl(var(--mesa-ocupada))]',
    icon: Users,
  },
  {
    key: 'en_cobro',
    label: 'En cobro',
    valueClass: 'text-[hsl(var(--mesa-cobro))]',
    icon: CircleDollarSign,
  },
  {
    key: 'libres',
    label: 'Disponibles',
    valueClass: 'text-[hsl(var(--mesa-libre))]',
    icon: CheckCircle2,
  },
]

function resolveKpiValue(kpis, key) {
  if (!kpis) return 0
  const aliases = {
    total: ['total', 'total_mesas'],
    libres: ['libres', 'mesas_libres'],
    ocupadas: ['ocupadas', 'mesas_ocupadas'],
    en_cobro: ['en_cobro', 'mesas_en_cobro'],
  }
  for (const alias of aliases[key] || [key]) {
    if (kpis[alias] != null) return kpis[alias]
  }
  return 0
}

function KPICard({ config, value, loading, index }) {
  const Icon = config.icon
  const staggerClass = `stagger-${Math.min(index + 1, 6)}`

  if (config.featured) {
    return (
      <article
        className={cn(
          'animate-fade-in-up',
          staggerClass,
          'relative overflow-hidden rounded-2xl border border-[hsl(var(--primary)/0.35)]',
          'bg-[hsl(var(--primary))] p-4 text-[hsl(var(--primary-foreground))] shadow-sm',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--primary-foreground)/0.75)]">{config.label}</p>
            <p className="mt-2 text-3xl font-bold leading-none tracking-tight">
              {loading ? '—' : value ?? 0}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary-foreground)/0.15)]">
            <Icon size={20} />
          </span>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'animate-fade-in-up',
        staggerClass,
        'flex items-start justify-between gap-3 rounded-2xl border border-[hsl(var(--border))]',
        'bg-[hsl(var(--card))] p-4 shadow-sm',
      )}
    >
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{config.label}</p>
        <p className={cn('mt-2 text-3xl font-bold leading-none tracking-tight', config.valueClass)}>
          {loading ? '—' : value ?? 0}
        </p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        <Icon size={18} />
      </span>
    </article>
  )
}

export default function MesasKPICards({ localId, onRefreshReady }) {
  const { kpis, loading, error, refresh } = useMesasKPIs(localId)

  if (onRefreshReady) onRefreshReady(refresh)

  return (
    <section className="space-y-3">
      {error && (
        <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map((config, i) => (
          <KPICard
            key={config.key}
            config={config}
            value={resolveKpiValue(kpis, config.key)}
            loading={loading}
            index={i}
          />
        ))}
      </div>
    </section>
  )
}
