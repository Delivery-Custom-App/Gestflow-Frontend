import { cn } from '@/lib/utils'
import { explicacionSePrepara } from '../../lib/tipoProducto'

/** Switch "Este producto se prepara", con la línea que explica qué cambia. */
export default function InterruptorSePrepara({ id, checked, onChange, disabled = false }) {
  const ayudaId = `${id}-ayuda`
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border))] px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-[hsl(var(--foreground))]">Este producto se prepara</label>
        <p id={ayudaId} className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{explicacionSePrepara(checked)}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={ayudaId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative isolate mt-0.5 h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]',
        )}
      >
        <span className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
    </div>
  )
}
