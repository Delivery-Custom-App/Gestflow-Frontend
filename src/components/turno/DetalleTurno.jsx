import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '../LoadingSpinner'
import { parseApiDate } from '../../utils/chileDateTime'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { getCajaResumen } from '../../lib/salesApi'
import { movimientosDelTurno, totalesDelTurno } from '../../lib/registroTurnos'

// Canal del pedido (mesa, mostrador, delivery…), no cómo pagó el cliente.
const MOVIMIENTO_SOURCE_LABEL = {
  dine_in: 'Mesa',
  takeout: 'Para llevar',
  mostrador: 'Mostrador',
  delivery: 'Delivery',
  haulmer_pos: 'Haulmer POS',
  mercadopago_pos: 'Mercado Pago',
}

// Cómo pagó el cliente (CajaResumenPorMetodo.payment_method).
const PAYMENT_METHOD_LABEL = {
  cash: 'Efectivo',
  MERCADOPAGO_POINT: 'Mercado Pago',
  MERCADOPAGO_POINT_DEBIT: 'Mercado Pago (débito)',
  MERCADOPAGO_POINT_CREDIT: 'Mercado Pago (crédito)',
}

function fechaHora(value) {
  const date = value ? parseApiDate(value) : null
  if (!date) return 'Sin fecha'
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago', hour12: true,
  })
}

function Cifra({ label, valor, destacada = false }) {
  return (
    <div className={destacada
      ? 'rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] p-3'
      : 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3'}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{valor}</p>
    </div>
  )
}

/**
 * Resumen de un turno: cuántas ventas hubo, ingresos y egresos, el desglose
 * por método de pago y sus movimientos. `conArqueo` agrega el monto de
 * apertura y el total esperado (vista del encargado y del dueño).
 */
export default function DetalleTurno({ caja, conArqueo = false }) {
  // De qué turno es lo cargado: si no es el que se muestra, está cargando.
  const [cargado, setCargado] = useState(null)

  useEffect(() => {
    let ignore = false
    Promise.all([getCajaResumen(caja.id), movimientosDelTurno(caja.id)])
      .then(([resumen, movimientos]) => { if (!ignore) setCargado({ id: caja.id, resumen, movimientos, err: '' }) })
      .catch((e) => {
        if (!ignore) setCargado({ id: caja.id, resumen: null, movimientos: [], err: e?.message || 'No se pudo cargar el resumen del turno' })
      })
    return () => { ignore = true }
  }, [caja.id])

  if (cargado?.id !== caja.id) return <LoadingSpinner message="Cargando el resumen del turno..." />
  const { resumen, movimientos, err } = cargado
  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
      </div>
    )
  }

  const { ventas, egresos } = totalesDelTurno(movimientos)
  const porMetodo = Array.isArray(resumen?.por_metodo) ? resumen.por_metodo : []

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Cifra label="Ventas" valor={String(ventas)} />
        <Cifra label="Ingresos" valor={formatMoney(Number(resumen?.total_ingresos))} />
        <Cifra label="Egresos" valor={formatMoney(egresos)} />
        {conArqueo && (
          <>
            <Cifra label="Apertura" valor={formatMoney(Number(resumen?.monto_apertura))} />
            <div className="col-span-2">
              <Cifra label="Total esperado" valor={formatMoney(Number(resumen?.total_esperado))} destacada />
            </div>
          </>
        )}
      </div>

      {porMetodo.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Desglose por método de pago</h3>
          {conArqueo && (
            <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">Para arquear, compara el monto de Mercado Pago aquí contra el reporte de la app/sitio de Mercado Pago.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {porMetodo.map((row) => (
              <div key={row.payment_method} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span className="text-[hsl(var(--foreground))]">{PAYMENT_METHOD_LABEL[row.payment_method] || row.payment_method}</span>
                <span className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(Number(row.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Movimientos</h3>
        {movimientos.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Todavía no hay movimientos registrados en este turno.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {movimientos.map((mov) => {
              const esEgreso = mov.tipo === 'egreso'
              return (
                <li key={mov.id} className="flex items-start justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                  <div className="min-w-0 flex-1">
                    <strong className={`block text-sm font-bold ${esEgreso ? 'text-red-600 dark:text-red-400' : 'text-[hsl(var(--foreground))]'}`}>
                      {esEgreso ? `− ${formatMoney(Number(mov.monto))}` : formatMoney(Number(mov.monto))}
                    </strong>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{fechaHora(mov.created_at)}</p>
                    {mov.order_id && (
                      <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">Orden {String(mov.order_id).slice(0, 8)}</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {esEgreso ? 'Egreso' : (MOVIMIENTO_SOURCE_LABEL[mov.payment_source] || mov.payment_source || 'Ingreso')}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
