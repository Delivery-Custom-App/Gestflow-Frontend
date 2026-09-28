import { useEffect, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBoleta, getComanda } from '../../lib/salesApi'
import { boletaHtml, comandaHtml, formatCantidad, formatFechaTicket, imprimirEnNavegador, metodoPagoLegible, ordenCorta } from '../../lib/ticketPrint'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'

/**
 * Muestra la comanda o la boleta de una orden y permite imprimirla.
 *
 * Los dos documentos los arma el backend (`/orders/{id}/comanda` y
 * `/orders/{id}/boleta`); la impresión la resuelve el navegador, porque no
 * existe servicio de impresoras. Primero se ven en pantalla: en muchos locales
 * basta con leer la comanda, sin gastar papel.
 */
export default function TicketModal({ tipo = 'comanda', orderId, createdAt, onClose }) {
  const esBoleta = tipo === 'boleta'
  const [ticket, setTicket] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    const pedir = esBoleta ? getBoleta : getComanda
    pedir(orderId, createdAt)
      .then((datos) => { if (!ignore) { setTicket(datos); setError('') } })
      .catch((e) => { if (!ignore) setError(e?.message || `No se pudo obtener la ${esBoleta ? 'boleta' : 'comanda'}`) })
      .finally(() => { if (!ignore) setCargando(false) })
    return () => { ignore = true }
  }, [orderId, createdAt, esBoleta])

  const imprimir = () => {
    if (!ticket) return
    imprimirEnNavegador(esBoleta ? boletaHtml(ticket) : comandaHtml(ticket))
  }

  const items = Array.isArray(ticket?.items) ? ticket.items : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">
            {esBoleta ? 'Boleta' : 'Comanda'} {ticket ? ordenCorta(ticket.order_id) : ''}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {cargando && <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando…</p>}

          {!cargando && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!cargando && !error && ticket && (
            <div className="font-mono text-xs text-[hsl(var(--foreground))]">
              <div className="text-center">
                <p className="text-sm font-bold tracking-widest">
                  {esBoleta ? (ticket.business_name || 'BOLETA') : 'COMANDA'}
                </p>
                {esBoleta && ticket.business_rut && <p className="opacity-70">RUT {ticket.business_rut}</p>}
                <p className="opacity-70">{ticket.local_name}</p>
                {ticket.mesa_nombre && <p className="font-semibold">{ticket.mesa_nombre}</p>}
                <p className="opacity-70">{formatFechaTicket(ticket.created_at)}</p>
              </div>

              <div className="my-3 border-t border-dashed border-[hsl(var(--border))]" />

              {items.length === 0 ? (
                <p className="opacity-70">{esBoleta ? 'Sin ítems' : 'Sin ítems para preparar'}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((item, i) => (
                    <li key={`${item.product_name}-${i}`} className="flex gap-2">
                      <span className="font-bold shrink-0">{formatCantidad(item.quantity)}x</span>
                      <span className="flex-1">{item.product_name}</span>
                      {esBoleta && <span className="shrink-0">{formatMoney(item.subtotal)}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {esBoleta && (
                <>
                  <div className="my-3 border-t border-dashed border-[hsl(var(--border))]" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>TOTAL</span><span>{formatMoney(ticket.total)}</span>
                  </div>
                  <div className="flex justify-between opacity-70">
                    <span>Neto</span><span>{formatMoney(ticket.net_amount)}</span>
                  </div>
                  <div className="flex justify-between opacity-70">
                    <span>IVA incluido (19%)</span><span>{formatMoney(ticket.iva_amount)}</span>
                  </div>
                  {ticket.payment_method && (
                    <p className="mt-2 text-center opacity-70">Pagado con {metodoPagoLegible(ticket.payment_method)}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          <Button size="sm" onClick={imprimir} disabled={!ticket || cargando}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  )
}
