import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Todas las acciones de Mesas miden lo mismo que «Crear mesa» (h-10 = 40 px).
 * Desactivado no es «casi invisible»: el fondo y el borde cambian, pero el
 * texto conserva contraste (sin bajar la opacidad).
 */
const BASE = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed'

const VARIANTES = {
  borde: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] disabled:border-dashed disabled:bg-[hsl(var(--muted))] disabled:text-[hsl(var(--muted-foreground))] disabled:hover:border-[hsl(var(--border))] disabled:hover:text-[hsl(var(--muted-foreground))]',
  primario: 'border border-transparent bg-[hsl(var(--primary))] text-white shadow-sm hover:opacity-90 disabled:border-dashed disabled:border-[hsl(var(--border))] disabled:bg-[hsl(var(--muted))] disabled:text-[hsl(var(--muted-foreground))] disabled:shadow-none disabled:hover:opacity-100',
}

/**
 * Botón de las acciones de Mesas. Con `motivo` queda desactivado y dice por qué
 * en un texto a la vista (un `title` no se ve en tablet ni con teclado), ligado
 * al botón con `aria-describedby`. `disabled` desactiva sin dar motivo.
 */
export default function AccionDeMesas({
  icon: Icono = null, variante = 'borde', motivo = null, disabled = false, className, children, ...props
}) {
  const motivoId = useId()
  const desactivado = disabled || Boolean(motivo)
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={desactivado}
        aria-describedby={motivo ? motivoId : undefined}
        className={cn(BASE, VARIANTES[variante], className)}
        {...props}
      >
        {Icono && <Icono size={16} aria-hidden="true" />}
        {children}
      </button>
      {motivo && (
        <p id={motivoId} className="max-w-[13rem] text-xs leading-snug text-[hsl(var(--muted-foreground))]">{motivo}</p>
      )}
    </div>
  )
}
