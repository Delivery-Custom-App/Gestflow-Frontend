import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { textoDiferencia } from '../../lib/arqueo'

const dinero = (valor) => (valor === null || valor === undefined ? '—' : formatMoney(valor))

function Linea({ id, etiqueta, valor, destacada = false, clase = '' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1', destacada && 'border-t border-[hsl(var(--border))] pt-2 font-semibold')}>
      <dt className="text-[hsl(var(--muted-foreground))]">{etiqueta}</dt>
      <dd data-testid={`resumen-${id}`} className={cn('tabular-nums text-[hsl(var(--foreground))]', destacada && 'font-bold', clase)}>{valor}</dd>
    </div>
  )
}

/**
 * Resumen del cierre, en una sola pantalla y antes de confirmar (T-55): fondo
 * inicial, ventas por medio de pago, ingresos de caja, retiros y gastos,
 * efectivo esperado y, en una caja física, lo contado y la diferencia. Los
 * montos son los de `GET /cajas/{id}/resumen`; las ventas por medio salen de los
 * movimientos. `resumen` es lo de `armarResumenCierre`.
 */
export default function ResumenCierre({ resumen, digital = false, etiquetaRetiros = 'Retiros y gastos' }) {
  if (!resumen) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el resumen del cierre…</p>
  const { fondo, ventas, ingresosCaja, retiros, esperado, contado, diferencia } = resumen
  const claseDiferencia = diferencia === null ? '' : diferencia < 0 ? 'text-red-600' : diferencia > 0 ? 'text-amber-700' : 'text-emerald-700'

  return (
    <section aria-label="Resumen del cierre" className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Resumen del cierre</h3>
      <dl>
        <Linea id="fondo" etiqueta="Fondo inicial" valor={dinero(fondo)} />
        <Linea id="ventas-efectivo" etiqueta="Ventas en efectivo" valor={dinero(ventas?.efectivo)} />
        <Linea id="ventas-tarjeta" etiqueta="Ventas con tarjeta" valor={dinero(ventas?.tarjeta)} />
        <Linea id="ventas-transferencia" etiqueta="Ventas por transferencia" valor={dinero(ventas?.transferencia)} />
        {ventas?.otros > 0 && <Linea id="ventas-otros" etiqueta="Ventas con otros medios" valor={dinero(ventas.otros)} />}
        <Linea id="ingresos" etiqueta="Ingresos de caja" valor={dinero(ingresosCaja)} />
        <Linea id="retiros" etiqueta={etiquetaRetiros} valor={dinero(retiros)} />
        <Linea id="esperado" etiqueta="Efectivo esperado" valor={dinero(esperado)} destacada />
        {!digital && <Linea id="contado" etiqueta="Efectivo contado" valor={dinero(contado)} />}
        {!digital && <Linea id="diferencia" etiqueta="Diferencia" valor={textoDiferencia(diferencia) ?? '—'} clase={claseDiferencia} />}
      </dl>
      {digital && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Caja digital: se cierra sin contar efectivo.</p>}
    </section>
  )
}
