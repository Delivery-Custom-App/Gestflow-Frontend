import { useEffect, useRef, useState } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { apiRequest } from '../../lib/apiClient'
import MesaDetailModal from './MesaDetailModal'
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

function openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  const orderId = firstOrder?.id ? `#${firstOrder.id.slice(0, 8).toUpperCase()}` : '—'

  const itemsHTML = allItems.map(item => `
    <tr>
      <td>${item.quantity}</td>
      <td>${item.item_name || item.product_name || '—'}</td>
      <td class="right">$${(item.unit_price || 0).toLocaleString('es-CL')}</td>
      <td class="right">$${(item.total_price || 0).toLocaleString('es-CL')}</td>
    </tr>
  `).join('')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Boleta ${orderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111; width: 280px; padding: 8px; }
    h2 { font-size: 18px; text-align: center; }
    .center { text-align: center; margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #222; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding-bottom: 6px; font-size: 11px; }
    td { padding: 2px 0; vertical-align: top; }
    .right { text-align: right; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .total { font-weight: 700; font-size: 14px; }
    .small { font-size: 11px; margin-top: 6px; }
    @media print { @page { margin: 4mm; size: 72mm auto; } }
  </style>
</head>
<body>
  <div class="center">
    <h2>RESTAURANTE</h2>
    <p style="font-weight:700">COMANDA</p>
    <p style="font-family:monospace">${orderId}</p>
  </div>
  <hr/>
  <div class="row"><span>ATENCION:</span><span>${mesa.name || '—'}</span></div>
  <hr/>
  <table>
    <thead>
      <tr>
        <th>CANT</th>
        <th>DETALLE</th>
        <th class="right">P.UNIT</th>
        <th class="right">TOTAL</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <hr/>
  <div class="row"><span>Subtotal:</span><span>$ ${subtotal.toLocaleString('es-CL')}</span></div>
  <div class="row"><span>IVA 19%:</span><span>$ ${iva.toLocaleString('es-CL')}</span></div>
  <div class="row total"><span>TOTAL:</span><span>$ ${total.toLocaleString('es-CL')}</span></div>
  <p class="small">Fecha: ${dateStr} ${timeStr}</p>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`

  const newWin = window.open('', '_blank')
  if (newWin) {
    newWin.document.open()
    newWin.document.write(html)
    newWin.document.close()
  }
}

export default function OrdenView({ mesa, localId, onBack, onTableUpdated }) {
  const { detail, loading, error: mesaError, refresh } = useMesaDetail(mesa.id)
  const { updateOrderStatus } = useOrderManagement()
  const hasTransitioned = useRef(false)
  const [cancelLoading, setCancelLoading]   = useState(false)
  const [cobrarLoading, setCobrarLoading]   = useState(false)
  const [errorMsg, setErrorMsg]             = useState('')
  const [showAddItems, setShowAddItems]     = useState(false)

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
  }, [detail, onTableUpdated, refresh, updateOrderStatus])

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

  const handleCobrar = async () => {
    if (!detail?.active_orders?.length) return
    setCobrarLoading(true)
    setErrorMsg('')
    try {
      for (const order of detail.active_orders) {
        await updateOrderStatus(order.id, 'COMPLETED')
      }
      await apiRequest(`/mesas/${mesa.id}/state`, {
        method: 'PATCH',
        body: { state: 'libre' },
      })
      openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total })
      onTableUpdated?.()
      onBack()
    } catch (err) {
      setErrorMsg(err.message || 'Error al cobrar la orden')
      setCobrarLoading(false)
    }
  }

  const allItems = (detail?.active_orders || []).flatMap(o => o.items || [])
  const subtotal = allItems.reduce((s, item) => s + (item.total_price || 0), 0)
  const iva = Math.round(subtotal * 0.19)
  const total = subtotal + iva
  const firstOrder = detail?.active_orders?.[0]

  const formatItemName = (item) => item.item_name || item.product_name || '—'

  const formatItemDetails = (item) => {
    const details = []
    if (item.item_name && item.product_name && item.item_name !== item.product_name) {
      details.push(`Base: ${item.product_name}`)
    }
    if (item.product_description) {
      details.push(item.product_description)
    }
    return details
  }

  const visibleError = errorMsg || mesaError

  return (
    <>
      {showAddItems && localId && (
        <MesaDetailModal
          mesa={mesa}
          localId={localId}
          onClose={() => { setShowAddItems(false); refresh(); onTableUpdated?.() }}
          onTableUpdated={() => { refresh(); onTableUpdated?.() }}
        />
      )}

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
              onClick={handleCobrar}
              disabled={cobrarLoading || cancelLoading || !detail?.active_orders?.length}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {cobrarLoading ? 'Procesando...' : '💰 Cobrar e imprimir'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddItems(true)}
              disabled={!localId}
            >
              + Agregar Otro Producto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelOrder}
              disabled={cancelLoading || cobrarLoading || !detail?.active_orders?.length}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              {cancelLoading ? 'Cancelando...' : 'Cancelar'}
            </Button>
          </div>
        </div>

        {visibleError && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {visibleError}
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
                              <div className="space-y-0.5">
                                <p className="font-medium text-[hsl(var(--foreground))]">{formatItemName(item)}</p>
                                {formatItemDetails(item).length > 0 && (
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {formatItemDetails(item).join(' · ')}
                                  </p>
                                )}
                              </div>
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
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">IVA 19%</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-green-600">✓</span>
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                            ${iva.toLocaleString('es-CL')}
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
    </>
  )
}

