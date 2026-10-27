import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router'
import { CreditCard } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cancelOrder, createOrder, fetchProductsCatalog, listPedidosSinCobrarDelTurno } from '../../lib/salesApi'
import { formatCLP } from '../../lib/formatCLP'
import { obtenerClaveIdempotencia, traducirErrorIdempotencia } from '../../lib/idempotency'
import { getPointOrderStatus } from '../../lib/cobroTarjeta'
import { useCajaActiva } from '../../hooks/useCajaActiva'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MercadoPagoModal from './MercadoPagoModal'
import TicketModal from './TicketModal'
import MPConfigDrawer from './MPConfigDrawer'
import PedidosSinCobrar from './PedidosSinCobrar'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import IniciarMiTurno from '../caja/IniciarMiTurno'
import MiTurnoDeVenta from '../caja/MiTurnoDeVenta'
import { sePrepara } from '../../lib/tipoProducto'

/**
 * Venta directa "al paso": listado plano de los productos del local. Crea la
 * orden sin mesa (source: "mostrador") y cobra vía MercadoPagoModal.
 *
 * El stock no bloquea la venta (#147): si el sistema tiene menos de lo que hay
 * en el mostrador, el conteo estaba mal. El backend deja el stock en 0 y anota
 * el faltante en el historial; acá solo se avisa que habrá que recontar.
 */
function ProductCard({ product, qty, onAdd, onRemove }) {
  // Los productos que se preparan no llevan stock por unidades.
  const llevaStock = !sePrepara(product)
  const stock = product.stock ?? 0
  const faltarian = llevaStock ? Math.max(0, qty - stock) : 0
  return (
    <div
      className={cn(
        'group flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all',
        qty > 0
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 shadow-sm'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--accent))]'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold leading-tight text-[hsl(var(--foreground))] break-words">{product.name}</p>
        {llevaStock && (
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Stock: {stock}</p>
        )}
        {faltarian > 0 && (
          <p className="mt-1 text-xs font-semibold text-amber-600">
            El sistema tiene {stock}: faltarán {faltarian}. Vuelve a contar el producto.
          </p>
        )}
        <p className="mt-2 text-lg font-black text-[hsl(var(--primary))]">${formatCLP(product.price || 0)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {qty > 0 && (
          <button type="button" aria-label={`Quitar ${product.name}`}
            onClick={() => onRemove(product.id)}
            className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-2xl font-black shadow-sm transition-colors hover:bg-[hsl(var(--accent))]"
          >
            −
          </button>
        )}
        {qty > 0 && <span className="min-w-8 text-center text-xl font-black text-[hsl(var(--primary))]">{qty}</span>}
        <button type="button" aria-label={`Agregar ${product.name}`}
          onClick={() => onAdd(product.id)}
          className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-[hsl(var(--primary))] text-2xl font-black text-white shadow-md transition-colors hover:bg-[hsl(var(--primary))]/90"
        >
          +
        </button>
      </div>
    </div>
  )
}

/**
 * #160: lanza si la máquina tiene el cobro con tarjeta del pedido (o no se pudo comprobar):
 * mejor no cancelar que perder un pago. Sin Mercado Pago Point no hay nada que comprobar.
 */
async function asegurarSinCobroVivo(orderId) {
  if (!isV2FeatureEnabled('mercadopagoPoint')) return
  let estado
  try {
    estado = await getPointOrderStatus(orderId)
  } catch {
    throw new Error('No se pudo comprobar el cobro en la máquina. Vuelve a intentarlo en unos segundos.')
  }
  if (estado?.point_charge_active === true) {
    throw new Error('Hay un cobro con tarjeta en la máquina: cancélalo en el lector o espera a que venza. Para seguirlo pulsa «Cobrar».')
  }
}

export default function VentaDirectaView() {
  const { localId } = useParams()
  const { isWorker } = useAuth()
  const { cajaId, caja: miTurno, loading: buscandoTurno, recargar: recargarTurno } = useCajaActiva(localId)

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedQtys, setSelectedQtys] = useState({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [activeOrder, setActiveOrder] = useState(null) // { id, total }
  const [showMPModal, setShowMPModal] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showMPConfig, setShowMPConfig] = useState(false)
  const [pendientes, setPendientes] = useState([])
  const idempotencyKeyRef = useRef(null)

  // #159: los pedidos del turno que quedaron sin cobrar (traban el «Terminar turno»).
  const cargarPendientes = useCallback(() => {
    if (!cajaId) { setPendientes([]); return }
    listPedidosSinCobrarDelTurno(cajaId).then(setPendientes).catch(() => {})
  }, [cajaId])

  useEffect(() => { cargarPendientes() }, [cargarPendientes])

  const loadCatalog = useCallback(() => {
    if (!localId) return
    setLoading(true)
    fetchProductsCatalog(localId)
      .then((groups) => {
        const flat = (Array.isArray(groups) ? groups : []).flatMap((g) => g.products || [])
        setProducts(flat)
      })
      .catch((err) => setError(err?.message || 'No se pudo cargar el listado de productos'))
      .finally(() => setLoading(false))
  }, [localId])

  useEffect(() => { loadCatalog() }, [loadCatalog])

  // #159: con otro carrito es otra venta: la clave del intento anterior ya no sirve.
  const handleAdd = useCallback((id) => {
    idempotencyKeyRef.current = null
    setSelectedQtys((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
  }, [])
  const handleRemove = useCallback((id) => {
    idempotencyKeyRef.current = null
    setSelectedQtys((prev) => {
      const next = { ...prev }
      if ((next[id] || 0) <= 1) delete next[id]
      else next[id]--
      return next
    })
  }, [])

  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)
  const subtotal = useMemo(
    () => Object.entries(selectedQtys).reduce((s, [id, qty]) => {
      const p = products.find((prod) => prod.id === id)
      return s + (p?.price || 0) * qty
    }, 0),
    [selectedQtys, products]
  )

  const handleCobrar = async () => {
    if (!totalItems) { setError('Selecciona al menos un producto'); return }
    setProcessing(true); setError(''); setSuccessMsg('')
    try {
      const items = Object.entries(selectedQtys).map(([id, quantity]) => {
        const p = products.find((prod) => prod.id === id)
        return { product_id: id, quantity, unit_price: p?.price || 0 }
      })
      const idempotencyKey = obtenerClaveIdempotencia(idempotencyKeyRef)
      const order = await createOrder({
        local_id: localId,
        mesa_id: null,
        caja_id: cajaId || null,
        source: 'mostrador',
        items,
        idempotency_key: idempotencyKey,
      })
      idempotencyKeyRef.current = null
      setActiveOrder({ id: order.id, total: order.total ?? subtotal, created_at: order.created_at })
      setShowMPModal(true)
    } catch (err) {
      const traducido = traducirErrorIdempotencia(err)
      if (traducido?.claveUsada || err?.pedidoCancelado) idempotencyKeyRef.current = null
      const mensaje = traducido?.message || 'Error al crear la orden'
      setError(err?.pedidoCancelado ? `${mensaje} La venta no quedó guardada: revisa el carrito y vuelve a cobrar.` : mensaje)
      cargarPendientes()
    } finally {
      setProcessing(false)
    }
  }

  const cobrarPendiente = useCallback((pedido) => {
    setError(''); setSuccessMsg('')
    // `retomado`: si se cierra el cobro, el pedido sigue en la lista (no se cancela solo).
    setActiveOrder({ id: pedido.id, total: pedido.total ?? 0, created_at: pedido.created_at, retomado: true })
    setShowMPModal(true)
  }, [])

  const cancelarPendiente = useCallback(async (pedido) => {
    // #160: con el cobro vivo en la máquina, cancelar el pedido deja el pago con tarjeta sin registrar.
    await asegurarSinCobroVivo(pedido.id)
    await cancelOrder(pedido.id, pedido.created_at)
    cargarPendientes()
  }, [cargarPendientes])

  /**
   * La boleta la arma el backend (`/orders/{id}/boleta`) y se muestra en
   * pantalla para imprimirla desde el navegador. Antes se pedía a
   * `/comandas/{id}/receipt`, que no existe, y se mandaba por Bluetooth a un
   * servicio de impresoras que tampoco existe.
   */
  const [boletaOrderId, setBoletaOrderId] = useState(null)

  const printReceipt = useCallback((orderId) => {
    if (!isV2FeatureEnabled('receiptPrint')) return
    setBoletaOrderId(orderId)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    const orderId = activeOrder?.id
    const retomado = activeOrder?.retomado
    setShowMPModal(false)
    setActiveOrder(null)
    if (!retomado) setSelectedQtys({})
    setSuccessMsg('Venta registrada correctamente.')
    loadCatalog()
    cargarPendientes()
    if (orderId && isV2FeatureEnabled('receiptPrint')) printReceipt(orderId)
  }, [loadCatalog, cargarPendientes, activeOrder, printReceipt])

  /** Cierra sin pagar: cancela la orden abandonada para que no quede PENDING para siempre. */
  const handleAbandonCheckout = useCallback(() => {
    const order = activeOrder
    setShowMPModal(false)
    setActiveOrder(null)
    if (order?.id && !order.retomado) {
      // Si el cobro sigue en la máquina el pedido no se cancela: queda en «Pedidos sin cobrar».
      asegurarSinCobroVivo(order.id)
        .then(() => cancelOrder(order.id, order.created_at))
        .catch(() => {})
        .finally(cargarPendientes)
    }
  }, [activeOrder, cargarPendientes])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 p-4 lg:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-[hsl(var(--foreground))]">Venta directa</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Selecciona productos y cobra sin pasar por mesa.</p>
        </div>

        {/* #133: el dueño o el encargado vende con su propio turno, sobre una caja abierta. */}
        {!isWorker && isV2FeatureEnabled('cajaFisicaManda') && !buscandoTurno && !cajaId && (
          <IniciarMiTurno localId={localId} onIniciado={recargarTurno} />
        )}
        {/* #141: con su turno abierto, lo puede terminar (hace falta para cerrar la caja). */}
        {!isWorker && isV2FeatureEnabled('cajaFisicaManda') && !buscandoTurno && cajaId && (
          <MiTurnoDeVenta turno={miTurno} onTerminado={recargarTurno} />
        )}

        {!isWorker && isV2FeatureEnabled('mpConfig') && (
          <button
            type="button"
            onClick={() => setShowMPConfig(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <CreditCard size={16} />
            Configurar POS
          </button>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button type="button" aria-label="Cerrar mensaje de error" className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMsg}<button type="button" aria-label="Cerrar mensaje" className="ml-2 underline text-xs" onClick={() => setSuccessMsg('')}>✕</button>
          </div>
        )}

        <PedidosSinCobrar pedidos={pendientes} onCobrar={cobrarPendiente} onCancelar={cancelarPendiente} />

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No hay productos disponibles en este local.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} qty={selectedQtys[p.id] || 0} onAdd={handleAdd} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <div className="px-4 lg:px-6 py-4 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--card))]">
          <div className="flex items-center justify-between w-full gap-3">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {totalItems} ítem{totalItems !== 1 ? 's' : ''} ·{' '}
              <span className="font-bold text-[hsl(var(--primary))]">${formatCLP(subtotal)}</span>
            </span>
            <Button
              onClick={handleCobrar}
              disabled={processing}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {processing ? 'Procesando...' : `Cobrar · $${formatCLP(subtotal)}`}
            </Button>
          </div>
        </div>
      )}

      {activeOrder && (
        <MercadoPagoModal
          open={showMPModal}
          orderId={activeOrder.id}
          createdAt={activeOrder.created_at}
          total={activeOrder.total}
          description="Venta directa"
          onSuccess={handlePaymentSuccess}
          onClose={handleAbandonCheckout}
        />
      )}

      {!isWorker && isV2FeatureEnabled('mpConfig') && (
        <MPConfigDrawer
          open={showMPConfig}
          localId={localId}
          onClose={() => setShowMPConfig(false)}
        />
      )}

      {boletaOrderId && (
        <TicketModal tipo="boleta" orderId={boletaOrderId} onClose={() => setBoletaOrderId(null)} />
      )}
    </div>
  )
}
