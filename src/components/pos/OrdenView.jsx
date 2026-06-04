import { useEffect, useRef, useState } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { Button } from '@/components/ui/button'

const STATUS_BADGE = {
  pending:   'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABEL = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'En Cobro',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function printReceiptAsPDF({ mesa, firstOrder, allItems, subtotal, serviceFee, total }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  const orderId = firstOrder?.id ? `#${firstOrder.id.slice(0, 8).toUpperCase()}` : '—'

  const itemsHTML = allItems.map(item => `
    <tr>
      <td>${item.quantity}</td>
      <td>${item.product_name || '—'}</td>
      <td class="right">$${(item.unit_price || 0).toLocaleString('es-CL')}</td>
      <td class="right">$${(item.total_price || 0).toLocaleString('es-CL')}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Boleta ${orderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111; width: 72mm; margin: 0 auto; padding: 8px; }
    .center { text-align: center; }
    .right { text-align: right; }
    h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .divider { border-top: 1px dashed #555; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 10px; text-align: left; padding: 2px 0; border-bottom: 1px solid #555; }
    th.right, td.right { text-align: right; }
    td { padding: 2px 0; vertical-align: top; }
    .total-row { font-size: 14px; font-weight: bold; }
    @media print {
      body { width: 72mm; }
      @page { margin: 0; size: 72mm auto; }
    }
  </style>
</head>
<body>
  <div class="center">
    <h1>BOLETA</h1>
    <p>${dateStr} ${timeStr}</p>
    <p>Orden: ${orderId}</p>
  </div>
  <div class="divider"></div>
  <div class="row"><span>Mesa:</span><span>${mesa.name || '—'}</span></div>
  ${mesa.zona ? `<div class="row"><span>Zona:</span><span>${mesa.zona}</span></div>` : ''}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Cant.</th>
        <th>Producto</th>
        <th class="right">P.Unit</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>$${subtotal.toLocaleString('es-CL')}</span></div>
  <div class="row"><span>Cargo servicio (10%)</span><span>$${serviceFee.toLocaleString('es-CL')}</span></div>
  <div class="divider"></div>
  <div class="row total-row"><span>TOTAL</span><span>$${total.toLocaleString('es-CL')}</span></div>
  <div class="divider"></div>
  <div class="center" style="margin-top:8px;font-size:10px;">
    <p>Gracias por su visita</p>
  </div>
  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); } }</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export default function OrdenView({ mesa, onBack, onTableUpdated }) {
  const { detail, loading, error, refresh } = useMesaDetail(mesa.id)
  const { updateOrderStatus } = useOrderManagement()
  const hasTransitioned = useRef(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // When the view opens, transition PENDING/PREPARING orders → READY (triggers en_cobro)
  useEffect(() => {
    if (!detail || hasTransitioned.current) return
    hasTransitioned.current = true

    const toTransition = (detail.active_orders || []).filter(
      o => o.status === 'pending' || o.status === 'preparing'
    )
    if (!toTransition.length) return

    Promise.all(toTransition.map(o => updateOrderStatus(o.id, 'READY')))
      .then(() => { refresh(); onTableUpdated?.() })
      .catch(err => setErrorMsg(err.message || 'Error actualizando estado'))
  }, [detail])

  const handleCancelOrder = async () => {
    if (!detail?.active_orders?.length) return
    if (!window.confirm('¿Cancelar la orden y liberar la mesa?')) return
    setCancelLoading(true)
    setErrorMsg('')
    try {
      for (const order of detail.active_orders) {
        await updateOrderStatus(order.id, 'CANCELLED')
      }
      onTableUpdated?.()
      onBack()
    } catch (err) {
      setErrorMsg(err.message || 'Error al cancelar la orden')
      setCancelLoading(false)
    }
  }

  const allItems = (detail?.active_orders || []).flatMap(o => o.items || [])
  const subtotal = allItems.reduce((s, item) => s + (item.total_price || 0), 0)
  const serviceFee = Math.round(subtotal * 0.1)
  const total = subtotal + serviceFee
  const firstOrder = detail?.active_orders?.[0]

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb + acciones */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[hsl(var(--border))] bg-white shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            ← Mesas
          </button>
          <span className="text-[hsl(var(--muted-foreground))]">/</span>
          <span className="font-medium text-[hsl(var(--foreground))]">{mesa.name}</span>
          {mesa.zona && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">— {mesa.zona}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelOrder}
            disabled={cancelLoading || !detail?.active_orders?.length}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            {cancelLoading ? 'Cancelando...' : '✕ Cancelar Orden'}
          </Button>
          <Button
            size="sm"
            onClick={() => printReceiptAsPDF({ mesa, firstOrder, allItems, subtotal, serviceFee, total })}
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
          >
            🖨 Imprimir Recibo
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando pedido...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl">

            {/* Columna izquierda: info + detalle + facturación */}
            <div className="lg:col-span-2 space-y-4">

              {/* Información general */}
              <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">
                  Información General
                </h3>
                <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Order ID</p>
                    <p className="font-mono font-medium text-[hsl(var(--foreground))] text-xs">
                      #{firstOrder?.id?.slice(0, 8).toUpperCase() || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Tipo</p>
                    <p className="text-[hsl(var(--foreground))]">
                      {firstOrder?.source === 'dine-in' ? 'En Local' : firstOrder?.source || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Estado</p>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[firstOrder?.status || 'pending']}`}>
                      {STATUS_LABEL[firstOrder?.status || 'pending']}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Mesa</p>
                    <p className="text-[hsl(var(--foreground))]">{mesa.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Fecha Creación</p>
                    <p className="text-[hsl(var(--foreground))]">{fmt(firstOrder?.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Hora</p>
                    <p className="text-[hsl(var(--foreground))]">{fmtTime(firstOrder?.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Detalle del pedido + facturación */}
              <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">
                  Detalle del Pedido
                </h3>

                {allItems.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    No hay productos en el pedido
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[hsl(var(--accent))]">
                        <th className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] px-3 py-2 rounded-l-lg w-20">
                          Cantidad
                        </th>
                        <th className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] px-3 py-2">
                          Nombre
                        </th>
                        <th className="text-right text-xs font-medium text-[hsl(var(--muted-foreground))] px-3 py-2">
                          Precio Unit.
                        </th>
                        <th className="text-right text-xs font-medium text-[hsl(var(--muted-foreground))] px-3 py-2 rounded-r-lg">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allItems.map((item) => (
                        <tr key={item.id} className="border-b border-[hsl(var(--border))] last:border-0">
                          <td className="px-3 py-2.5 font-medium text-[hsl(var(--foreground))]">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2.5 text-[hsl(var(--foreground))]">
                            {item.product_name}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[hsl(var(--muted-foreground))]">
                            ${(item.unit_price || 0).toLocaleString('es-CL')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-[hsl(var(--foreground))]">
                            ${(item.total_price || 0).toLocaleString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Facturación */}
                <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]">
                  <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Facturación</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Subtotal</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                        ${subtotal.toLocaleString('es-CL')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">10% Cargo Servicio</p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-green-600">✓</span>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                          ${serviceFee.toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Total</p>
                      <p className="text-base font-bold text-[hsl(var(--primary))]">
                        ${total.toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna derecha: órdenes activas */}
            <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-5 h-fit">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Órdenes</h3>

              {!detail?.active_orders?.length ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin órdenes activas</p>
              ) : (
                <div className="space-y-3">
                  {detail.active_orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-start justify-between py-2 border-b border-[hsl(var(--border))] last:border-0 gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-mono font-medium text-[hsl(var(--foreground))]">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {(order.payment_method || 'cash').toUpperCase()} · {(order.items || []).length} producto(s)
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status || 'pending']}`}>
                        {STATUS_LABEL[order.status || 'pending']}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Total a pagar</span>
                <span className="text-base font-bold text-[hsl(var(--primary))]">
                  ${total.toLocaleString('es-CL')}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
