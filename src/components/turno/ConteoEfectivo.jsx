import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { cantidadDesdeTexto, etiquetaDenominacion, totalesDelConteo } from '../../lib/efectivo'

const btnCls = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40'

/**
 * Conteo del efectivo por denominación (T-40): cantidad de cada billete y
 * moneda, con su subtotal y los totales. Controlado: `cantidades` es
 * { [valor]: cantidad } y `onChange` recibe el objeto nuevo.
 */
export default function ConteoEfectivo({ cantidades, onChange, disabled = false }) {
  const { filas, totalBilletes, totalMonedas, total } = totalesDelConteo(cantidades)

  const fijar = (valor, cantidad) => onChange({ ...cantidades, [valor]: Math.max(0, cantidad) })

  const grupo = (tipo, titulo, totalGrupo) => (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{titulo}</h3>
        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]" data-testid={`total-${tipo}`}>{formatMoney(totalGrupo)}</span>
      </div>
      {filas.filter((f) => f.tipo === tipo).map((f) => {
        const nombre = `${tipo === 'billete' ? 'billetes' : 'monedas'} de ${etiquetaDenominacion(f.valor)}`
        return (
          <div key={f.valor} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm font-semibold text-[hsl(var(--foreground))]">{etiquetaDenominacion(f.valor)}</span>
            <button type="button" className={btnCls} aria-label={`Quitar uno: ${nombre}`}
              disabled={disabled || f.cantidad === 0} onClick={() => fijar(f.valor, f.cantidad - 1)}>
              <Minus size={16} />
            </button>
            <input
              type="text" inputMode="numeric" aria-label={`Cantidad de ${nombre}`}
              value={f.cantidad === 0 ? '' : String(f.cantidad)} placeholder="0" disabled={disabled}
              onChange={(e) => fijar(f.valor, cantidadDesdeTexto(e.target.value))}
              className="h-11 w-16 min-w-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-center text-base font-semibold text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)]"
            />
            <button type="button" className={btnCls} aria-label={`Agregar uno: ${nombre}`}
              disabled={disabled} onClick={() => fijar(f.valor, f.cantidad + 1)}>
              <Plus size={16} />
            </button>
            <span className={cn('ml-auto text-right text-sm tabular-nums',
              f.subtotal > 0 ? 'font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>
              {formatMoney(f.subtotal)}
            </span>
          </div>
        )
      })}
    </section>
  )

  return (
    <div className="flex flex-col gap-4">
      {grupo('billete', 'Billetes', totalBilletes)}
      {grupo('moneda', 'Monedas', totalMonedas)}
      <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--primary)/0.08)] px-4 py-3">
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Total en efectivo</span>
        <span className="text-lg font-bold text-[hsl(var(--foreground))]" data-testid="total-efectivo">{formatMoney(total)}</span>
      </div>
    </div>
  )
}
