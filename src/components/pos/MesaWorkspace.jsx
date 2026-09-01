import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, DollarSign, Menu as MenuIcon, Printer, Receipt, Split, X } from 'lucide-react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useOrderTotals } from '../../hooks/useOrderTotals'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { addOrderItem, createOrder, setMesaLibre } from '../../lib/salesApi'
import { getSplitPaymentSummary } from '../../lib/apiClient'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MenuCategoryAccordion from './menu-picker/MenuCategoryAccordion'
import MenuItemRow from './menu-picker/MenuItemRow'
import RecipeCustomizer from './menu-picker/RecipeCustomizer'
import { calcItemPrice, isCompleto, productKey } from './menu-picker/menuPricing'
import MultiPaymentModal from './MultiPaymentModal'
import MercadoPagoModal from './MercadoPagoModal'
import {
  STATUS_BADGE,
  STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  fmt,
  fmtTime,
  openPrintWindow,
} from './order-panel/orderPrint'

const EMPTY_CUSTOMIZATION = { embutido: null, agregados: [] }

export default function MesaWorkspace({ mesa, localId, cajaId, onBack, onTableUpdated }) {
  const { detail, loading, error: mesaError, refresh } = useMesaDetail(mesa.id)
  const { updateOrderStatus } = useOrderManagement()
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)
  const { allItems, subtotal, iva, total, firstOrder } = useOrderTotals(detail)

  const [selectedQtys, setSelectedQtys] = useState({})
  const [customizations, setCustomizations] = useState({})
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())
  const [submitting, setSubmitting] = useState(false)

  const [cancelLoading, setCancelLoading] = useState(false)
  const [cobrarLoading, setCobrarLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitFullyPaid, setSplitFullyPaid] = useState(false)
  const [hasSplits, setHasSplits] = useState(false)
  const [showMPModal, setShowMPModal] = useState(false)
  const [mobileTab, setMobileTab] = useState('menu') // 'menu' | 'pedido'

  const submittingRef = useRef(false)

  useEffect(() => { fetchMenu() }, [fetchMenu])

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

  /* ─── menú: misma carta que el Creador de menú (fetchPosMenu / local-products activos) ─── */
  const allMenuProducts = useMemo(() =>
    (menuData?.categories ?? []).flatMap(c => c.products || []),
    [menuData]
  )

  const categorizedItems = useMemo(() => {
    return (menuData?.categories ?? [])
      .map((cat) => ({
        name: cat.name || 'Sin categoría',
        items: (cat.products || []).map((p) => ({
          key: productKey(p.id),
          id: p.id,
          type: 'product',
          categoryName: cat.name || 'Sin categoría',
          name: p.name,
          description: p.description || '',
          price: p.price || 0,
        })),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [menuData])

  const allMenuItems = useMemo(() => categorizedItems.flatMap(cat => cat.items), [categorizedItems])

  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)
  const stagedSubtotal = Object.entries(selectedQtys).reduce((s, [key, qty]) => {
    const it = allMenuItems.find(i => i.key === key)
    const cust = customizations[key]
    return s + calcItemPrice(it?.price || 0, cust) * qty
  }, 0)

  const menuItemsSelected = useMemo(() =>
    allMenuItems.filter(it => it.type === 'recipe' && (selectedQtys[it.key] || 0) > 0),
    [allMenuItems, selectedQtys]
  )

  const collapseKey = useCallback((key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const handleAddItem = useCallback((key) => {
    setSelectedQtys(prev => {
      const wasZero = !(prev[key] || 0)
      if (wasZero) {
        const it = allMenuItems.find(i => i.key === key)
        if (it?.type === 'recipe') {
          setExpandedKeys(prevSet => new Set(prevSet).add(key))
          setCustomizations(prevCust => prevCust[key] ? prevCust : { ...prevCust, [key]: { ...EMPTY_CUSTOMIZATION, agregados: [] } })
        }
      }
      return { ...prev, [key]: (prev[key] || 0) + 1 }
    })
  }, [allMenuItems])

  const handleRemoveItem = useCallback((key) => {
    setSelectedQtys(prev => {
      const next = { ...prev }
      if ((next[key] || 0) <= 1) {
        delete next[key]
        collapseKey(key)
      } else {
        next[key]--
      }
      return next
    })
  }, [collapseKey])

  const handleAgregarAlPedido = useCallback(async () => {
    if (!totalItems || submittingRef.current) return
    const sandwichSinProteina = menuItemsSelected
      .filter(it => !isCompleto(it))
      .find(it => !(customizations[it.key]?.embutido))
    if (sandwichSinProteina) {
      setErrorMsg(`Selecciona una proteína para "${sandwichSinProteina.name}"`)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setErrorMsg('')
    try {
      const items = Object.entries(selectedQtys).map(([key, quantity]) => {
        const it = allMenuItems.find(i => i.key === key)
        const cust = customizations[key]
        const unitPrice = Math.round(calcItemPrice(it?.price || 0, cust))
        return { product_id: it?.id, quantity, unit_price: unitPrice }
      })
      if (firstOrder) {
        for (const item of items) {
          await addOrderItem(firstOrder.id, item, firstOrder.created_at)
        }
      } else {
        await createOrder({ local_id: localId, mesa_id: mesa.id, caja_id: cajaId || null, source: 'dine_in', items })
      }
      setSelectedQtys({})
      setCustomizations({})
      setExpandedKeys(new Set())
      await refresh()
      onTableUpdated?.()
    } catch (err) {
      setErrorMsg(err?.message || 'Error al agregar productos al pedido')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [totalItems, menuItemsSelected, customizations, selectedQtys, allMenuItems, firstOrder, localId, mesa.id, cajaId, refresh, onTableUpdated])

  /* ─── cobro / acciones (trasladado de OrdenView) ─── */
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

  const handleCobrar = useCallback(() => {
    if (!detail?.active_orders?.length) return
    if (hasSplits && !splitFullyPaid) {
      setErrorMsg('Pago dividido incompleto. Aprueba todos los pagos antes de cobrar.')
      return
    }
    setErrorMsg('')
    setShowMPModal(true)
  }, [detail, hasSplits, splitFullyPaid])

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
    openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total, label: 'DETALLE DE COBRO' })
  }, [detail?.active_orders?.length, mesa, firstOrder, allItems, subtotal, iva, total])

  const formatItemName = (item) => item.item_name || item.product_name || '—'
  const visibleError = errorMsg || mesaError

  /* ─── fila de menú, con customizador inline para recetas ─── */
  const renderMenuRow = useCallback((it) => {
    const qty = selectedQtys[it.key] || 0
    const needsCustomization = it.type === 'recipe'
    const expanded = expandedKeys.has(it.key)
    return (
      <div key={it.key} className={cn(needsCustomization && expanded && qty > 0 && 'sm:col-span-2 xl:col-span-3')}>
        <MenuItemRow item={it} qty={qty} onAdd={handleAddItem} onRemove={handleRemoveItem} />
        {needsCustomization && expanded && qty > 0 && (
          <div className="mt-2 space-y-2">
            <RecipeCustomizer
              variant={isCompleto(it) ? 'completo' : 'sandwich'}
              item={it}
              qty={qty}
              customization={customizations[it.key] || EMPTY_CUSTOMIZATION}
              onChange={(val) => setCustomizations(prev => ({ ...prev, [it.key]: val }))}
              availableProducts={allMenuProducts}
            />
            <button
              type="button"
              onClick={() => collapseKey(it.key)}
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
            >
              Listo ✓
            </button>
          </div>
        )}
      </div>
    )
  }, [selectedQtys, expandedKeys, customizations, allMenuProducts, handleAddItem, handleRemoveItem, collapseKey])

  /* ─── panel de menú ─── */
  const menuPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-4 py-4 space-y-3">
        {menuLoading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Cargando menú...</p>
          </div>
        ) : categorizedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No hay productos en venta para este local</p>
            <p className="mt-1 max-w-xs text-xs text-[hsl(var(--muted-foreground))]">Actívalos en Inventario → Menú (misma carta que Mesas).</p>
          </div>
        ) : (
          categorizedItems.map(cat => (
            <MenuCategoryAccordion
              key={cat.name}
              label={cat.name}
              items={cat.items}
              selectedQtys={selectedQtys}
              onAdd={handleAddItem}
              onRemove={handleRemoveItem}
              renderItem={renderMenuRow}
            />
          ))
        )}
      </div>

      {totalItems > 0 && (
        <div className="px-4 py-3 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--card))]">
          <div className="flex items-center justify-between w-full gap-3">
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{totalItems} producto{totalItems !== 1 ? 's' : ''}</p>
              <p className="text-lg font-bold text-[hsl(var(--primary))]">${formatCLP(stagedSubtotal)}</p>
            </div>
            <Button
              size="lg"
              onClick={handleAgregarAlPedido}
              disabled={submitting}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-bold px-6 h-12 rounded-xl shadow-lg"
            >
              {submitting ? 'Agregando...' : 'Agregar al pedido'}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: pastilla de total, salta a la tab Pedido */}
      <button
        type="button"
        onClick={() => setMobileTab('pedido')}
        className="lg:hidden flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--accent))]"
      >
        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Total mesa</span>
        <span className="text-base font-bold text-[hsl(var(--primary))]">${formatCLP(total)} →</span>
      </button>
    </div>
  )

  /* ─── panel de pedido/cobro ─── */
  const orderPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 lg:px-5 py-4 border-b border-[hsl(var(--border))] shrink-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCobrar}
            disabled={cobrarLoading || cancelLoading || !detail?.active_orders?.length || (hasSplits && !splitFullyPaid)}
            className="flex-1 min-w-[120px] h-11 rounded-xl font-semibold shadow-sm bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white disabled:opacity-50"
            title={hasSplits && !splitFullyPaid ? 'Aprueba todos los pagos divididos primero' : ''}
          >
            <DollarSign size={18} className="mr-2" />
            {cobrarLoading ? 'Procesando...' : 'Cobrar'}
          </Button>
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
          {isV2FeatureEnabled('splitPayments') && firstOrder?.id && (
            <Button
              onClick={() => setShowSplitModal(true)}
              disabled={!detail?.active_orders?.length}
              variant="outline"
              size="icon"
              className={cn(
                'h-11 w-11 rounded-xl',
                hasSplits && splitFullyPaid && 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100',
                hasSplits && !splitFullyPaid && 'border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              )}
              title={hasSplits && splitFullyPaid ? 'Pago dividido completo' : 'Dividir pago'}
            >
              <Split size={18} />
            </Button>
          )}
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
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 lg:px-5 py-4 space-y-4">
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Información General</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Order ID</p>
              <p className="font-mono font-medium text-[hsl(var(--foreground))] text-xs">#{firstOrder?.id?.slice(0, 8).toUpperCase() || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Estado</p>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[firstOrder?.status || 'pending']}`}>
                {STATUS_LABEL[firstOrder?.status || 'pending']}
              </span>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Fecha</p>
              <p className="text-[hsl(var(--foreground))]">{fmt(firstOrder?.created_at)} · {fmtTime(firstOrder?.created_at)}</p>
            </div>
            {firstOrder?.payment_status && (
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Pago</p>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_BADGE[firstOrder.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                  {PAYMENT_STATUS_LABEL[firstOrder.payment_status] || firstOrder.payment_status}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Detalle del Pedido</h3>
          {allItems.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay productos en el pedido</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--accent))]">
                  <th className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-2 rounded-l-lg w-12">Cant.</th>
                  <th className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-2">Nombre</th>
                  <th className="text-right text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-2 rounded-r-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item) => (
                  <tr key={item.id} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="px-2 py-2 font-medium text-[hsl(var(--foreground))]">{item.quantity}</td>
                    <td className="px-2 py-2 text-[hsl(var(--foreground))]">{formatItemName(item)}</td>
                    <td className="px-2 py-2 text-right font-medium text-[hsl(var(--foreground))]">${(item.total_price || 0).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 lg:px-5 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="grid grid-cols-3 gap-3 text-sm mb-2">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Subtotal</p>
            <p className="font-medium text-[hsl(var(--foreground))]">${subtotal.toLocaleString('es-CL')}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">IVA 19%</p>
            <p className="font-medium text-[hsl(var(--foreground))]">${iva.toLocaleString('es-CL')}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Total</p>
            <p className="text-base font-bold text-[hsl(var(--primary))]">${total.toLocaleString('es-CL')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-2">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Total a pagar</span>
          <span className="text-lg font-bold text-[hsl(var(--primary))]">${total.toLocaleString('es-CL')}</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
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

      <div className="flex flex-col h-full min-h-0">
        <div className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shrink-0 px-4 lg:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
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

          {/* Tabs mobile */}
          <div className="lg:hidden mt-3 flex gap-2">
            <button
              onClick={() => setMobileTab('menu')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold', mobileTab === 'menu' ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]')}
            >
              <MenuIcon size={15} /> Menú
            </button>
            <button
              onClick={() => setMobileTab('pedido')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold', mobileTab === 'pedido' ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]')}
            >
              <Receipt size={15} /> Pedido
            </button>
          </div>
        </div>

        {visibleError && (
          <div className="mx-4 lg:mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 shrink-0">
            {visibleError}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-[hsl(var(--muted-foreground))]">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Cargando mesa...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5">
            <div className={cn('lg:col-span-3 lg:border-r border-[hsl(var(--border))] min-h-0', mobileTab !== 'menu' && 'hidden lg:block')}>
              {menuPanel}
            </div>
            <div className={cn('lg:col-span-2 min-h-0', mobileTab !== 'pedido' && 'hidden lg:block')}>
              {orderPanel}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
