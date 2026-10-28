import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, DollarSign, Menu as MenuIcon, Minus, Plus, Printer, Receipt, Split, Trash2, X } from 'lucide-react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { desgloseIva, totalDeOrden, useOrderTotals } from '../../hooks/useOrderTotals'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { addOrderItem, createOrder, removeOrderItem, setMesaLibre, updateOrderItem } from '../../lib/salesApi'
import { obtenerClaveIdempotencia, traducirErrorIdempotencia } from '../../lib/idempotency'
import { liberarGrupoAlCobrar } from '../../lib/liberarGrupo'
import { getSplitPaymentSummary } from '../../lib/apiClient'
import { getPointOrderStatus } from '../../lib/cobroTarjeta'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { MENSAJE_ENCARGADO_NO_ABRE_PEDIDOS } from '../../lib/rolesCaja'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MenuCategoryAccordion from './menu-picker/MenuCategoryAccordion'
import MenuItemRow from './menu-picker/MenuItemRow'
import RecipeCustomizer from './menu-picker/RecipeCustomizer'
import { calcItemPrice, isCompleto, productKey } from './menu-picker/menuPricing'
import MultiPaymentModal from './MultiPaymentModal'
import MercadoPagoModal from './MercadoPagoModal'
import LiberarMesaModal from './LiberarMesaModal'
import ComandaActions from './ComandaActions'
import { formatCantidad } from '@/lib/utils'
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

// Botones de la barra de acciones de la mesa: 48 px de alto y con texto, para tocarlos en tablet.
const BOTON_ACCION = 'h-12 min-w-[140px] flex-1 rounded-xl text-base [&_svg]:size-5'

const formatItemName = (item) => item.item_name || item.product_name || '—'

export default function MesaWorkspace({ mesa, atencion = null, localId, cajaId, puedeCobrar = true, puedeLiberarMesa = false, onBack, onTableUpdated, onGrupoActualizado }) {
  const { detail, loading, error: mesaError, refresh, updateAfterItemRemoval } = useMesaDetail(mesa.id)
  const { updateOrderStatus } = useOrderManagement()
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)
  const { allItems, subtotal, iva, total, firstOrder } = useOrderTotals(detail)
  // #156: si dos equipos abrieron la mesa a la vez, quedan dos pedidos activos. Se cobran
  // de a uno (primero `firstOrder`) y la mesa se libera recién con el último.
  const pedidosActivos = detail?.active_orders?.length ?? 0
  const variosPedidos = pedidosActivos > 1
  const totalACobrar = variosPedidos ? totalDeOrden(firstOrder) : total
  // #167: el encargado de restaurante no abre pedidos (el backend responde 403: los abre el mesero con su turno), pero sí
  // puede sumar productos a uno ya abierto. Solo en una mesa sin pedido no hay nada que ofrecerle.
  const noPuedeAbrirPedido = !puedeCobrar && !firstOrder

  const [selectedQtys, setSelectedQtys] = useState({})
  const [guests, setGuests] = useState('1')
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
  const [showLiberarModal, setShowLiberarModal] = useState(false)
  const [offerLiberar, setOfferLiberar] = useState(false)
  const [avisoCobro, setAvisoCobro] = useState('')
  // #160: con el cobro con tarjeta vivo en la máquina no se cancela ni se libera la mesa.
  const [cobroVivo, setCobroVivo] = useState(false)
  const [mobileTab, setMobileTab] = useState('menu') // 'menu' | 'pedido'

  const submittingRef = useRef(false)
  const idempotencyKeyRef = useRef(null)

  useEffect(() => { fetchMenu() }, [fetchMenu])

  // Se consulta al entrar a la mesa y cada vez que se cierra la ventana de cobro.
  const pedidoId = firstOrder?.id
  useEffect(() => {
    if (showMPModal || !pedidoId || !isV2FeatureEnabled('mercadopagoPoint')) return undefined
    let vigente = true
    getPointOrderStatus(pedidoId)
      .then((s) => { if (vigente) setCobroVivo(s?.point_charge_active === true) })
      .catch(() => {})
    return () => { vigente = false }
  }, [pedidoId, showMPModal])
  const hayCobroVivo = cobroVivo && Boolean(pedidoId)

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
        color: cat.color || null,
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

  // #159: con otro carrito es otra acción: la clave del intento anterior ya no sirve.
  const handleAddItem = useCallback((key) => {
    idempotencyKeyRef.current = null
    if (!(selectedQtys[key] || 0)) {
      const it = allMenuItems.find(i => i.key === key)
      if (it?.type === 'recipe') {
        setExpandedKeys(prevSet => new Set(prevSet).add(key))
        setCustomizations(prevCust => prevCust[key] ? prevCust : { ...prevCust, [key]: { ...EMPTY_CUSTOMIZATION, agregados: [] } })
      }
    }
    setSelectedQtys(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [allMenuItems, selectedQtys])

  const handleRemoveItem = useCallback((key) => {
    idempotencyKeyRef.current = null
    if ((selectedQtys[key] || 0) <= 1) collapseKey(key)
    setSelectedQtys(prev => {
      const next = { ...prev }
      if ((next[key] || 0) <= 1) {
        delete next[key]
      } else {
        next[key]--
      }
      return next
    })
  }, [collapseKey, selectedQtys])

  const handleAgregarAlPedido = useCallback(async () => {
    if (!totalItems || submittingRef.current) return
    if (!firstOrder && (!Number.isInteger(Number(guests)) || Number(guests) < 1)) {
      setErrorMsg('Ingresa una cantidad válida de comensales.')
      return
    }
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
    // Claves de los productos que ya entraron al pedido existente, por si falla uno a mitad de camino.
    const agregados = []
    try {
      const idempotencyKey = obtenerClaveIdempotencia(idempotencyKeyRef)
      const items = Object.entries(selectedQtys).map(([key, quantity]) => {
        const it = allMenuItems.find(i => i.key === key)
        const cust = customizations[key]
        const unitPrice = Math.round(calcItemPrice(it?.price || 0, cust))
        return { product_id: it?.id, quantity, unit_price: unitPrice }
      })
      if (firstOrder) {
        const claves = Object.keys(selectedQtys)
        for (const [index, item] of items.entries()) {
          // Secuencial a propósito: conserva el orden de los ítems/comanda y evita escrituras concurrentes sobre la misma orden/mesa.
          // oxlint-disable-next-line react-doctor/async-await-in-loop
          await addOrderItem(firstOrder.id, item, firstOrder.created_at, `${idempotencyKey}:item:${index}`)
          agregados.push(claves[index])
        }
      } else {
        await createOrder({ local_id: localId, mesa_id: mesa.id, caja_id: cajaId || null, source: 'dine_in', guests: Number(guests), items, idempotency_key: idempotencyKey })
      }
      idempotencyKeyRef.current = null
      setSelectedQtys({})
      setCustomizations({})
      setExpandedKeys(new Set())
      await refresh()
      onTableUpdated?.()
    } catch (err) {
      const traducido = traducirErrorIdempotencia(err)
      if (traducido?.claveUsada || err?.pedidoCancelado) idempotencyKeyRef.current = null
      let mensaje = traducido?.message || 'Error al agregar productos al pedido'
      if (agregados.length > 0) {
        // Lo que ya entró al pedido sale del carrito: un reintento no lo agrega de nuevo. Con otro carrito va otra clave.
        idempotencyKeyRef.current = null
        const quitar = (prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !agregados.includes(k)))
        setSelectedQtys(quitar)
        setCustomizations(quitar)
        refresh()
        mensaje = `Se agregaron ${agregados.length} producto${agregados.length !== 1 ? 's' : ''} al pedido, pero falló el resto: ${mensaje} Revisa lo que queda en el carrito y vuelve a agregarlo.`
      }
      // El backend no deja un segundo pedido en la mesa (409): se recarga para mostrar el pedido que ya hay y agregarle ahí.
      if (Number(err?.status) === 409 && agregados.length === 0) refresh()
      setErrorMsg(err?.pedidoCancelado ? `${mensaje} El pedido no quedó guardado: revisa los productos y vuelve a agregarlos.` : mensaje)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [totalItems, firstOrder, guests, menuItemsSelected, customizations, selectedQtys, allMenuItems, localId, mesa.id, cajaId, refresh, onTableUpdated])

  /* ─── cobro / acciones (trasladado de OrdenView) ─── */
  const handleCancelOrder = useCallback(async () => {
    if (!detail?.active_orders?.length) return
    if (!window.confirm('¿Cancelar la orden y liberar la mesa?')) return
    setCancelLoading(true)
    setErrorMsg('')
    try {
      for (const order of detail.active_orders) {
        // Secuencial a propósito: conserva el orden de los ítems/comanda y evita escrituras concurrentes sobre la misma orden/mesa.
        // oxlint-disable-next-line react-doctor/async-await-in-loop
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
    setAvisoCobro('')
    setShowMPModal(true)
  }, [detail, hasSplits, splitFullyPaid])

  const handlePaymentSuccess = useCallback(async (_paymentMethod, tipAmount = 0) => {
    setShowMPModal(false)
    setCobrarLoading(true)
    if (variosPedidos) {
      // Quedan otros pedidos: se imprime la boleta de este y la mesa sigue ocupada.
      openPrintWindow({ mesa, firstOrder, allItems: firstOrder.items || [], ...desgloseIva(totalACobrar), tipAmount, totalWithTip: totalACobrar + Number(tipAmount || 0) })
      const faltan = pedidosActivos - 1
      setAvisoCobro(`Pedido cobrado. Falta${faltan !== 1 ? 'n' : ''} ${faltan} pedido${faltan !== 1 ? 's' : ''} de esta mesa por $${formatCLP(total - totalACobrar)}: pulsa «Cobrar» de nuevo.`)
      setCobrarLoading(false)
      onTableUpdated?.()
      await refresh()
      return
    }
    try {
      await setMesaLibre(mesa.id)
      // Mesas juntadas: las demás del grupo que quedaron ocupadas sin pedido se sueltan y el grupo se separa (también si cobra
      // un mesero). No lanza: el cobro ya está hecho y lo que pase con el grupo se le informa a quien cobró.
      const grupo = await liberarGrupoAlCobrar({ localId, mesaCobrada: mesa })
      openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total, tipAmount, totalWithTip: total + Number(tipAmount || 0) })
      onTableUpdated?.()
      if (grupo) onGrupoActualizado?.({ ...grupo, mesaCobrada: mesa.name })
      onBack()
    } catch (err) {
      setErrorMsg(err.message || 'Error al finalizar el cobro')
      if (Number(err?.status) === 409) {
        // Puede haber aparecido otro pedido en la mesa: se recarga para mostrarlo y cobrarlo.
        refresh()
        if (puedeLiberarMesa) setOfferLiberar(true)
      }
      setCobrarLoading(false)
    }
  }, [mesa, localId, firstOrder, allItems, subtotal, iva, total, variosPedidos, totalACobrar, pedidosActivos, refresh, onTableUpdated, onGrupoActualizado, onBack, puedeLiberarMesa])

  const handleMesaLiberada = useCallback(() => {
    setShowLiberarModal(false)
    setOfferLiberar(false)
    onTableUpdated?.()
    onBack()
  }, [onTableUpdated, onBack])

  const handlePrintChargeDetail = useCallback(() => {
    if (!detail?.active_orders?.length) return
    openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total, label: 'DETALLE DE COBRO' })
  }, [detail?.active_orders?.length, mesa, firstOrder, allItems, subtotal, iva, total])


  // Editar la cantidad o quitar un ítem ya enviado (T-30): PATCH solo con la
  // cantidad (el precio lo pone el backend) y DELETE; luego se recarga la mesa.
  const [itemOcupado, setItemOcupado] = useState('')
  // A-06: nota del ítem; vaciarla la borra (PATCH notes: null).
  const [editandoNota, setEditandoNota] = useState(null) // { item, texto }
  const ordenDelItem = useCallback(
    (item) => (detail?.active_orders || []).find((o) => (o.items || []).some((it) => it.id === item.id)),
    [detail],
  )
  const cambiarItem = useCallback(async (item, accion) => {
    const orden = ordenDelItem(item)
    if (!orden) return
    const nueva = Number(item.quantity) + (accion === 'mas' ? 1 : -1)
    if (accion === 'quitar' && !window.confirm(`¿Quitar ${formatItemName(item)} del pedido?`)) return
    if (accion === 'nota') {
      setItemOcupado(item.id)
      setErrorMsg('')
      try {
        await updateOrderItem(orden.id, item.id, { notes: String(editandoNota?.texto || '').trim() || null }, orden.created_at)
        setEditandoNota(null)
        await refresh()
      } catch (e) {
        setErrorMsg(e?.message || 'No se pudo guardar la nota')
      } finally {
        setItemOcupado('')
      }
      return
    }
    setItemOcupado(item.id)
    setErrorMsg('')
    try {
      if (accion === 'quitar' || nueva <= 0) {
        const result = await removeOrderItem(orden.id, item.id, orden.created_at)
        if (result?.orderTotal != null) updateAfterItemRemoval(orden.id, item.id, result.orderTotal)
        else await refresh()
      } else {
        await updateOrderItem(orden.id, item.id, { quantity: nueva }, orden.created_at)
        await refresh()
      }
    } catch (e) {
      setErrorMsg(e?.message || 'No se pudo cambiar el pedido')
    } finally {
      setItemOcupado('')
    }
  }, [ordenDelItem, refresh, updateAfterItemRemoval, editandoNota])
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
        {noPuedeAbrirPedido ? (
          <div role="note" className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Esta mesa todavía no tiene pedido</p>
            <p className="mt-1 max-w-xs text-xs text-[hsl(var(--muted-foreground))]">
              {MENSAJE_ENCARGADO_NO_ABRE_PEDIDOS} Cuando el mesero lo abra, podrás sumarle productos.
            </p>
          </div>
        ) : menuLoading ? (
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
              color={cat.color}
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
        {!detail?.active_orders?.length && !noPuedeAbrirPedido ? (
          <div className="flex items-center gap-3">
            <label htmlFor="mesa-comensales" className="text-sm font-medium">Comensales</label>
            <input
              id="mesa-comensales"
              type="number"
              min="1"
              step="1"
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
              className="w-20 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm"
            />
          </div>
        ) : firstOrder?.guests != null ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Comensales: {firstOrder.guests}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {puedeLiberarMesa && (detail?.active_orders?.length > 0 || mesa.state === 'ocupada') && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { setErrorMsg(''); setOfferLiberar(false); setShowLiberarModal(true) }}
              disabled={cobrarLoading || cancelLoading || hayCobroVivo}
              className={BOTON_ACCION}
            >
              Liberar mesa
            </Button>
          )}
          {puedeCobrar && <Button
            onClick={handleCobrar}
            disabled={cobrarLoading || cancelLoading || !detail?.active_orders?.length || (hasSplits && !splitFullyPaid)}
            className={cn(BOTON_ACCION, 'font-semibold shadow-sm bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white disabled:opacity-50')}
            title={hasSplits && !splitFullyPaid ? 'Aprueba todos los pagos divididos primero' : ''}
          >
            <DollarSign />
            {cobrarLoading ? 'Procesando...' : 'Cobrar'}
          </Button>}
          <Button
            onClick={handlePrintChargeDetail}
            disabled={!detail?.active_orders?.length}
            variant="outline"
            className={BOTON_ACCION}
            title="Imprimir detalle"
          >
            <Printer />
            Imprimir
          </Button>
          {/* La comanda de cocina se ve e imprime desde la mesa: la pantalla de Cocina está apagada (`kitchenView`). */}
          <ComandaActions
            orderId={firstOrder?.id}
            createdAt={firstOrder?.created_at}
            className={BOTON_ACCION}
          />
          {isV2FeatureEnabled('splitPayments') && firstOrder?.id && (
            <Button
              onClick={() => setShowSplitModal(true)}
              disabled={!detail?.active_orders?.length}
              variant="outline"
              className={cn(
                BOTON_ACCION,
                hasSplits && splitFullyPaid && 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100',
                hasSplits && !splitFullyPaid && 'border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              )}
              title={hasSplits && splitFullyPaid ? 'Pago dividido completo' : 'Dividir pago'}
            >
              <Split />
              Dividir pago
            </Button>
          )}
          <Button
            onClick={handleCancelOrder}
            disabled={cancelLoading || cobrarLoading || hayCobroVivo || !detail?.active_orders?.length}
            variant="outline"
            className={cn(BOTON_ACCION, 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300')}
            title="Cancelar orden"
          >
            <X />
            Cancelar orden
          </Button>
        </div>
        {hayCobroVivo && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Hay un cobro con tarjeta en la máquina: «Cancelar orden» y «Liberar mesa» quedan bloqueados hasta que el cliente pague,
            se cancele en el lector o venza. {puedeCobrar ? 'Pulsa «Cobrar» para seguirlo.' : ''}
          </p>
        )}
        {!puedeCobrar && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            En restaurante el administrador no cobra: cobra quien abrió la mesa. Puedes cancelar la orden o traspasar la mesa.
          </p>
        )}
      
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
                  <th className="text-right text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-2">Total</th>
                  <th className="px-2 py-2 rounded-r-lg"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item) => (
                  <tr key={item.id} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="px-2 py-2 font-medium text-[hsl(var(--foreground))]">{formatCantidad(item.quantity)}</td>
                    <td className="px-2 py-2 text-[hsl(var(--foreground))]">
                      {formatItemName(item)}
                      {editandoNota?.item.id === item.id ? (
                        <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); cambiarItem(item, 'nota') }}>
                          <input aria-label={`Nota de ${formatItemName(item)}`} maxLength={200} value={editandoNota.texto}
                            onChange={(e) => setEditandoNota({ item, texto: e.target.value })} placeholder="Ej: sin cebolla"
                            className="h-7 flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs" />
                          <button type="submit" disabled={itemOcupado === item.id} className="rounded px-2 text-xs font-semibold text-[hsl(var(--primary))]">Guardar</button>
                          <button type="button" onClick={() => setEditandoNota(null)} className="rounded px-1 text-xs">✕</button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => setEditandoNota({ item, texto: item.notes || '' })}
                          className="block text-left text-xs text-[hsl(var(--muted-foreground))] hover:underline"
                          aria-label={`${item.notes ? 'Editar' : 'Agregar'} nota de ${formatItemName(item)}`}>
                          {item.notes ? `Nota: ${item.notes}` : '+ nota'}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-[hsl(var(--foreground))]">${(item.total_price || 0).toLocaleString('es-CL')}</td>
                    <td className="px-1 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" disabled={itemOcupado === item.id || Number(item.quantity) <= 1}
                          onClick={() => cambiarItem(item, 'menos')} aria-label={`Restar uno de ${formatItemName(item)}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-40">
                          <Minus size={14} />
                        </button>
                        <button type="button" disabled={itemOcupado === item.id}
                          onClick={() => cambiarItem(item, 'mas')} aria-label={`Sumar uno de ${formatItemName(item)}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-40">
                          <Plus size={14} />
                        </button>
                        <button type="button" disabled={itemOcupado === item.id}
                          onClick={() => cambiarItem(item, 'quitar')} aria-label={`Quitar ${formatItemName(item)} del pedido`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Subtotal (neto)</p>
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

      {showLiberarModal && (
        <LiberarMesaModal
          mesa={mesa}
          totalPendiente={total}
          onClose={() => setShowLiberarModal(false)}
          onDone={handleMesaLiberada}
        />
      )}

      {firstOrder && (
        <MercadoPagoModal
          open={showMPModal}
          orderId={firstOrder.id}
          createdAt={firstOrder.created_at}
          total={totalACobrar}
          description={`Mesa ${mesa.name || mesa.numero || ''}${variosPedidos ? ` · pedido 1 de ${pedidosActivos}` : ''}`.trim()}
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
            {atencion && (
              <span className="ml-auto truncate text-xs text-[hsl(var(--muted-foreground))]">
                Atiende: <span className="font-semibold text-[hsl(var(--foreground))]">{atencion.atiende}</span>
                {atencion.antes && <> · antes: {atencion.antes}</>}
              </span>
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
          <div role="alert" className="mx-4 lg:mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 shrink-0">
            <span>{visibleError}</span>
            {offerLiberar && puedeLiberarMesa && (
              <span className="mt-2 flex flex-wrap items-center gap-2 text-red-700">
                {variosPedidos
                  ? 'Esta mesa todavía tiene pedidos sin cobrar: cóbralos con «Cobrar».'
                  : 'Si hay que dejarla disponible igual:'}
                <Button type="button" variant="outline" size="sm" disabled={hayCobroVivo} onClick={() => setShowLiberarModal(true)}>
                  Liberar mesa
                </Button>
                <span className="text-xs">Ojo: liberar la mesa cancela sin cobrar lo que quede pendiente.</span>
              </span>
            )}
          </div>
        )}

        {variosPedidos && (
          <div role="note" className="mx-4 lg:mx-6 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-900 shrink-0">
            Esta mesa tiene <strong>{pedidosActivos} pedidos abiertos</strong> (se abrieron a la vez desde dos equipos) por ${formatCLP(total)} en total.
            «Cobrar» los cobra de a uno: ahora el pedido 1 de {pedidosActivos}, por ${formatCLP(totalACobrar)}.
          </div>
        )}

        {avisoCobro && (
          <p role="status" className="mx-4 lg:mx-6 mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 shrink-0">
            {avisoCobro}
          </p>
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
