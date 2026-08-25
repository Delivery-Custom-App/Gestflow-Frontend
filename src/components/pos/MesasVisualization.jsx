import { memo } from 'react'
import { Pencil, Trash2, Users, DollarSign } from 'lucide-react'
import { formatCLP } from '../../lib/formatCLP'
import { cn } from '@/lib/utils'

/**
 * Grilla de mesas pulida inspirada en:
 * https://dribbble.com/shots/27183895-Restaurant-Dashboard-Table-Management
 */
function MesasVisualization({ mesas = [], loading = false, onMesaSelect = null, onEditMesa = null, onDeleteMesa = null }) {
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--muted))] border-t-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando mesas...</p>
        </div>
      </div>
    )
  }

  if (!mesas || mesas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 flex flex-col items-center gap-3 text-[hsl(var(--muted-foreground))]">
        <TableIllustration className="h-24 w-24 opacity-30" chairs={4} />
        <p className="text-sm font-medium">No hay mesas para mostrar</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
      {mesas.map((mesa, i) => (
        <MesaCard
          key={mesa.id}
          mesa={mesa}
          index={i}
          onMesaSelect={onMesaSelect}
          onEditMesa={onEditMesa}
          onDeleteMesa={onDeleteMesa}
        />
      ))}
    </div>
  )
}

export default memo(MesasVisualization)

const STATE_CONFIG = {
  libre: {
    label: 'Disponible',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    ring: 'ring-emerald-500/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  ocupada: {
    label: 'Ocupada',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
    border: 'border-orange-200/60 dark:border-orange-800/40',
    ring: 'ring-orange-500/20',
    accent: 'text-orange-600 dark:text-orange-400',
  },
  en_cobro: {
    label: 'En cobro',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    border: 'border-sky-200/60 dark:border-sky-800/40',
    ring: 'ring-sky-500/20',
    accent: 'text-sky-600 dark:text-sky-400',
  },
  inactiva: {
    label: 'Inactiva',
    badge: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    border: 'border-[hsl(var(--border))]',
    ring: 'ring-[hsl(var(--muted))]/20',
    accent: 'text-[hsl(var(--muted-foreground))]',
  },
}

function sizeLabel(capacidad) {
  const n = Number(capacidad) || 4
  if (n <= 2) return 'Pequeña'
  if (n <= 4) return 'Mediana'
  return 'Grande'
}

function mesaCode(mesa, index) {
  const raw = String(mesa.name || mesa.nombre || mesa.numero || '').trim()
  if (/^t-?\d+/i.test(raw)) return raw.toUpperCase().replace(/^t-?/i, 'T-')
  if (/^\d+$/.test(raw)) return `T-${String(raw).padStart(2, '0')}`
  if (raw.length <= 10) return raw
  return `T-${String(index + 1).padStart(2, '0')}`
}

function mesaTotal(mesa) {
  for (const value of [mesa.total_value, mesa.current_total, mesa.order_total, mesa.total]) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/** Ilustración top-down refinada (mesa + sillas con profundidad). */
function TableIllustration({ chairs = 4, className, stateKey = 'libre' }) {
  const n = Math.min(Math.max(Number(chairs) || 4, 2), 8)
  const layout = {
    2: [[60, 20], [60, 100]],
    3: [[60, 18], [25, 88], [95, 88]],
    4: [[60, 18], [60, 102], [18, 60], [102, 60]],
    5: [[60, 16], [100, 42], [88, 100], [32, 100], [20, 42]],
    6: [[60, 16], [98, 35], [98, 85], [60, 104], [22, 85], [22, 35]],
    7: [[60, 14], [92, 28], [105, 65], [80, 102], [40, 102], [15, 65], [28, 28]],
    8: [[60, 14], [90, 24], [108, 54], [90, 96], [60, 108], [30, 96], [12, 54], [30, 24]],
  }
  const seats = layout[n] || layout[4]

  const accentColor = {
    libre: 'rgba(16, 185, 129, 0.15)',
    ocupada: 'rgba(251, 146, 60, 0.15)',
    en_cobro: 'rgba(14, 165, 233, 0.15)',
    inactiva: 'rgba(148, 163, 184, 0.1)',
  }[stateKey] || 'rgba(148, 163, 184, 0.1)'

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`tableTop-${stateKey}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="50%" stopColor={accentColor} stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`chairGrad-${stateKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
        </linearGradient>
        <filter id="tableShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {seats.map(([cx, cy], i) => {
        const angle = Math.atan2(cy - 60, cx - 60)
        const backX = cx + Math.cos(angle) * 4
        const backY = cy + Math.sin(angle) * 4
        const isVertical = Math.abs(angle) > Math.PI / 4 && Math.abs(angle) < (3 * Math.PI) / 4

        return (
          <g key={i}>
            <rect
              x={backX - 10}
              y={backY - 7}
              width="20"
              height="14"
              rx="5"
              fill="url(#chairGrad-${stateKey})"
              opacity="0.9"
            />
            <rect
              x={cx - 7}
              y={cy - 5}
              width="14"
              height="10"
              rx="3"
              fill="currentColor"
              opacity="0.18"
            />
            {isVertical ? (
              <rect
                x={cx - 1}
                y={backY - 5}
                width="2"
                height="8"
                rx="1"
                fill="currentColor"
                opacity="0.25"
              />
            ) : (
              <rect
                x={backX - 5}
                y={cy - 1}
                width="8"
                height="2"
                rx="1"
                fill="currentColor"
                opacity="0.25"
              />
            )}
          </g>
        )
      })}

      <rect
        x="38"
        y="38"
        width="44"
        height="44"
        rx="12"
        fill="currentColor"
        opacity="0.08"
        filter="url(#tableShadow)"
      />
      <rect
        x="38"
        y="38"
        width="44"
        height="44"
        rx="12"
        fill={`url(#tableTop-${stateKey})`}
      />
      <rect
        x="38"
        y="38"
        width="44"
        height="44"
        rx="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <rect
        x="42"
        y="42"
        width="36"
        height="36"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
      />
    </svg>
  )
}

const MesaCard = memo(function MesaCard({ mesa, index, onMesaSelect, onEditMesa, onDeleteMesa }) {
  const stateKey = mesa.is_active === false ? 'inactiva' : (mesa.state || 'libre')
  const stateConfig = STATE_CONFIG[stateKey] || STATE_CONFIG.libre
  const capacidad = Number(mesa.capacidad) || 4
  const total = mesaTotal(mesa)
  const code = mesaCode(mesa, index)
  const staggerClass = `stagger-${Math.min((index % 6) + 1, 6)}`

  const handleOpen = () => {
    if (stateKey !== 'inactiva') onMesaSelect?.(mesa)
  }

  return (
    <div
      className={cn(
        'animate-fade-in-up',
        staggerClass,
        'group relative flex flex-col rounded-2xl border-2 transition-all duration-200',
        'bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--card))]/80',
        'shadow-sm hover:shadow-lg',
        stateConfig.border,
        stateKey === 'inactiva' ? 'opacity-50' : 'hover:-translate-y-1',
      )}
    >
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEditMesa && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditMesa(mesa) }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))] hover:scale-105"
              title="Editar mesa"
              aria-label="Editar mesa"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDeleteMesa && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteMesa(mesa) }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))] transition hover:bg-red-50 hover:text-[hsl(var(--destructive))] hover:scale-105 dark:hover:bg-red-950/30"
              title="Eliminar mesa"
              aria-label="Eliminar mesa"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
          stateConfig.badge
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', stateConfig.accent.replace('text-', 'bg-'))} />
          {stateConfig.label}
        </span>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        disabled={stateKey === 'inactiva'}
        className="flex flex-1 flex-col items-center px-4 pb-4 pt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
      >
        <div className="relative mb-4 text-[hsl(var(--muted-foreground))]">
          <TableIllustration className="h-32 w-32" chairs={capacidad} stateKey={stateKey} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold tracking-wider text-[hsl(var(--foreground))] drop-shadow-sm">
              {code}
            </span>
          </div>
        </div>

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2">
            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
              <Users size={14} />
              <span className="text-xs font-medium">Capacidad</span>
            </div>
            <span className="text-sm font-bold text-[hsl(var(--foreground))]">{capacidad}</span>
          </div>
          
          <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2">
            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
              <DollarSign size={14} />
              <span className="text-xs font-medium">Total</span>
            </div>
            <span className={cn('text-sm font-bold', stateConfig.accent)}>
              {total != null ? `$${formatCLP(total)}` : '—'}
            </span>
          </div>
        </div>

        <div className="mt-3 w-full text-center">
          <span className="inline-block rounded-full bg-[hsl(var(--muted))]/40 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {sizeLabel(capacidad)}
          </span>
        </div>
      </button>
    </div>
  )
})
