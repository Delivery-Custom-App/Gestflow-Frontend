import { useEffect, useState, useCallback, memo } from 'react'
import { ArrowLeft, Printer, Split, DollarSign, Plus, X, MoreVertical } from 'lucide-react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { useOrderTotals } from '../../hooks/useOrderTotals'
import { getSplitPaymentSummary } from '../../lib/apiClient'
import { setMesaLibre } from '../../lib/salesApi'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import MesaDetailModal from './MesaDetailModal'
import MultiPaymentModal from './MultiPaymentModal'
import MercadoPagoModal from './MercadoPagoModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  STATUS_BADGE,
  STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  fmt,
  fmtTime,
  openPrintWindow,
} from './order-panel/orderPrint'

function OrdenView({ mesa, localId, onBack, onTableUpdated }) {
  const { detail, loading, error: mesaError, refresh } = useMesaDetail(mesa.id)
  const { updateOrderStatus } = useOrderManagement()
  const [cancelLoading, setCancelLoading]       = useState(false)
  const [cobrarLoading, setCobrarLoading]       = useState(false)
  const [errorMsg, setErrorMsg]                 = useState('')
  const [showAddItems, setShowAddItems]         = useState(false)
  const [showSplitModal, setShowSplitModal]     = useState(false)
  const [splitFullyPaid, setSplitFullyPaid]     = useState(false)
  const [hasSplits, setHasSplits]               = useState(false)
  const [showMPModal, setShowMPModal]           = useState(false)
  const [showMobileMenu, setShowMobileMenu]     = useState(false)

  const { allItems, subtotal, iva, total, firstOrder } = useOrderTotals(detail)

  // AC2: Check split payment state whenever the order view loads or refreshes
  useEffect(() => {
    if (!isV2FeatureEnabled('splitPayments')) return
    const orderId = detail?.active_orders?.[0]?.id
    if (!orderId) return
    getSplitPaymentSummary(orderId)
      .then(s => {
        setHasSplits((s.splits || []).length > 0)
        setSplitFullyPaid(s.is_fully_paid)
      })
      .catch(() => {})
  }, [detail])

  const handleCancelOrder = useCallback(async () => {
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
  }, [detail, updateOrderStatus, onTableUpdated, onBack])

  // Abre el modal de pago (con validación de split payments)
  const handleCobrar = useCallback(() => {
    if (!detail?.active_orders?.length) return
    if (hasSplits && !splitFullyPaid) {
      setErrorMsg('Pago dividido incompleto. Aprueba todos los pagos antes de cobrar.')
      return
    }
    setErrorMsg('')
    setShowMPModal(true)
  }, [detail, hasSplits, splitFullyPaid])

  // Llamado por MercadoPagoModal al aprobar el pago (order ya COMPLETED vía simulate)
  const handlePaymentSuccess = useCallback(async () => {
    setShowMPModal(false)
    setCobrarLoading(true)
    try {
      await setMesaLibre(mesa.id)
      openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total })
      onTableUpdated?.()
      onBack()
    } catch (err) {
      setErrorMsg(err.message || 'Error al finalizar el cobro')
      setCobrarLoading(false)
    }
  }, [mesa, firstOrder, allItems, subtotal, iva, total, onTableUpdated, onBack])

  const handlePrintChargeDetail = useCallback(() => {
    if (!detail?.active_orders?.length) return
    openPrintWindow({
      mesa,
      firstOrder,
      allItems,
      subtotal,
      iva,
      total,
      label: 'DETALLE DE COBRO',
    })
  }, [detail?.active_orders?.length, mesa, firstOrder, allItems, subtotal, iva, total])

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

      {isV2FeatureEnabled('splitPayments') && showSplitModal && firstOrder && (
        <MultiPaymentModal
          order={firstOrder}
          orderTotal={total}
          onClose={() => { setShowSplitModal(false); refresh() }}
          onFullyPaid={() => { setSplitFullyPaid(true); setHasSplits(true) }}
        />
      )}

      {firstOrder && (
        <MercadoPagoModal
          open={showMPModal}
          orderId={firstOrder.id}
          total={total}
          description={`Mesa ${mesa.name || mesa.numero || ''}`.trim()}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowMPModal(false)}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header mejorado mobile-first */}
        <div className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shrink-0">
          {/* Breadcrumb */}
          <div className="px-4 lg:px-6 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Mesas</span>
              </button>
              <span className="text-[hsl(var(--muted-foreground))]">/</span>
              <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{mesa.name}</span>
              {mesa.zona && (
                <>
                  <span className="hidden md:inline text-[hsl(var(--muted-foreground))]">·</span>
                  <span className="hidden md:inline text-xs text-[hsl(var(--muted-foreground))]">{mesa.zona}</span>
                </>
              )}
            </div>
          </div>

          {/* Acciones principales */}
          <div className="px-4 lg:px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              {/* Acción principal: Cobrar */}
              <Button
                onClick={handleCobrar}
                disabled={cobrarLoading || cancelLoading || !detail?.active_orders?.length || (hasSplits && !splitFullyPaid)}
                className={cn(
                  "flex-1 min-w-[140px] h-11 rounded-xl font-semibold shadow-sm",
                  "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title={hasSplits && !splitFullyPaid ? 'Aprueba todos los pagos divididos primero' : ''}
              >
                <DollarSign size={18} className="mr-2" />
                {cobrarLoading ? 'Procesando...' : 'Cobrar'}
              </Button>

              {/* Agregar productos */}
              <Button
                onClick={() => setShowAddItems(true)}
                disabled={!localId}
                variant="outline"
                className="flex-1 min-w-[140px] h-11 rounded-xl font-medium"
              >
                <Plus size={18} className="mr-2" />
                Agregar
              </Button>

              {/* Acciones secundarias - Desktop */}
              <div className="hidden lg:flex gap-2">
                {/* Imprimir */}
                <Button
                  onClick={handlePrintChargeDetail}
                  disabled={!detail?.active_orders?.length}
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl"
                  title="Imprimir detalle"
                >
                  <Printer size={18} />
                </Button>

                {/* Dividir pago */}
                {isV2FeatureEnabled('splitPayments') && firstOrder?.id && (
                  <Button
                    onClick={() => setShowSplitModal(true)}
                    disabled={!detail?.active_orders?.length}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-11 w-11 rounded-xl",
                      hasSplits && splitFullyPaid && "border-green-500 bg-green-50 text-green-700 hover:bg-green-100",
                      hasSplits && !splitFullyPaid && "border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                    )}
                    title={hasSplits && splitFullyPaid ? 'Pago dividido completo' : 'Dividir pago'}
                  >
                    <Split size={18} />
                  </Button>
                )}

                {/* Cancelar */}
                <Button
                  onClick={handleCancelOrder}
                  disabled={cancelLoading || cobrarLoading || !detail?.active_orders?.length}
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  title="Cancelar orden"
                >
                  <X size={18} />
                </Button>
              </div>

              {/* Menú móvil */}
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden h-11 w-11 rounded-xl"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <MoreVertical size={18} />
              </Button>
            </div>

            {/* Menú desplegable móvil */}
            {showMobileMenu && (
              <div className="lg:hidden mt-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] space-y-2">
                <Button
                  onClick={() => { handlePrintChargeDetail(); setShowMobileMenu(false) }}
                  disabled={!detail?.active_orders?.length}
                  variant="ghost"
                  className="w-full justify-start h-11"
                >
                  <Printer size={18} className="mr-2" />
                  Imprimir detalle
                </Button>

                {isV2FeatureEnabled('splitPayments') && firstOrder?.id && (
                  <Button
                    onClick={() => { setShowSplitModal(true); setShowMobileMenu(false) }}
                    disabled={!detail?.active_orders?.length}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-11",
                      hasSplits && splitFullyPaid && "text-green-700",
                      hasSplits && !splitFullyPaid && "text-yellow-700"
                    )}
                  >
                    <Split size={18} className="mr-2" />
                    {hasSplits && splitFullyPaid ? 'Pago dividido ✓' : 'Dividir pago'}
                  </Button>
                )}

                <Button
                  onClick={() => { handleCancelOrder(); setShowMobileMenu(false) }}
                  disabled={cancelLoading || cobrarLoading || !detail?.active_orders?.length}
                  variant="ghost"
                  className="w-full justify-start h-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X size={18} className="mr-2" />
                  {cancelLoading ? 'Cancelando...' : 'Cancelar orden'}
                </Button>
              </div>
            )}
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
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
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
                        {firstOrder?.source === 'dine-in' ? 'En Local'
                          : firstOrder?.source === 'mercadopago_pos' ? 'MercadoPago POS'
                          : firstOrder?.source || '—'}
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

                    {/* AC1: Payment confirmation status */}
                    {firstOrder?.payment_status && (
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Pago</p>
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_BADGE[firstOrder.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                          {PAYMENT_STATUS_LABEL[firstOrder.payment_status] || firstOrder.payment_status}
                        </span>
                      </div>
                    )}

                    {/* AC4: MercadoPago external transaction ID for 1:1 traceability */}
                    {firstOrder?.external_transaction_id && (
                      <div className="col-span-2">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">ID Transacción MP</p>
                        <p className="font-mono text-xs text-[hsl(var(--foreground))] break-all">
                          {firstOrder.external_transaction_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalle del pedido + facturación */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
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
              <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 h-fit">
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

// Memoizado: el carrito no se re-renderiza si no cambian sus props (AC4).
export default memo(OrdenView)
