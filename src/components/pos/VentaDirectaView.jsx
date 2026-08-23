import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { CreditCard, Printer } from 'lucide-react'
import { apiRequest } from '../../lib/apiClient'
import { createOrder, fetchProductsCatalog } from '../../lib/salesApi'
import { formatCLP } from '../../lib/formatCLP'
import { useCajaActiva } from '../../hooks/useCajaActiva'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MercadoPagoModal from './MercadoPagoModal'
import PrinterConfigModal from './PrinterConfigModal'
import MPConfigDrawer from './MPConfigDrawer'
import { printEscposViaBluetooth } from '../../lib/bluetoothPrinter'
import { toast } from 'sonner'
import { isV2FeatureEnabled } from '../../lib/v2Features'

/**
 * Venta directa "al paso": listado plano de todos los productos sin receta
 * del local (GET /products/catalog, ya filtra stock > 0). Crea la orden sin
 * mesa (source: "mostrador") y cobra vía MercadoPagoModal.
 */
function ProductCard({ product, qty, onAdd, onRemove }) {
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
        <p className="text-base font-bold leading-tight text-[hsl(var(--foreground))] line-clamp-2">{product.name}</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Stock: {product.stock ?? 0}</p>
        <p className="mt-2 text-lg font-black text-[hsl(var(--primary))]">${formatCLP(product.price || 0)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {qty > 0 && (
          <button
            onClick={() => onRemove(product.id)}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-2xl font-black shadow-sm transition-colors hover:bg-[hsl(var(--accent))]"
          >
            −
          </button>
        )}
        {qty > 0 && <span className="min-w-8 text-center text-xl font-black text-[hsl(var(--primary))]">{qty}</span>}
        <button
          onClick={() => onAdd(product.id)}
          disabled={qty >= (product.stock ?? 0)}
          className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-[hsl(var(--primary))] text-2xl font-black text-white shadow-md transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function VentaDirectaView() {
  const { localId } = useParams()
  const { cajaId } = useCajaActiva(localId)

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedQtys, setSelectedQtys] = useState({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [activeOrder, setActiveOrder] = useState(null) // { id, total }
  const [showMPModal, setShowMPModal] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showPrinterConfig, setShowPrinterConfig] = useState(false)
  const [showMPConfig, setShowMPConfig] = useState(false)

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

  const handleAdd = useCallback((id) => {
    setSelectedQtys((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
  }, [])
  const handleRemove = useCallback((id) => {
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
      const order = await createOrder({
        local_id: localId,
        mesa_id: null,
        caja_id: cajaId || null,
        source: 'mostrador',
        items,
      })
      setActiveOrder({ id: order.id, total: order.total ?? subtotal })
      setShowMPModal(true)
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false)
    }
  }

  const printReceipt = useCallback(async (orderId) => {
    if (!isV2FeatureEnabled('receiptPrint')) return
    try {
      const res = await apiRequest(`/comandas/${orderId}/receipt`, { method: 'POST', body: {} })
      if (res?.warning) {
        toast.info(res.warning)
        return
      }
      if (res?.payload_base64) {
        toast.info('Elige la impresora para la boleta...')
        await printEscposViaBluetooth(res.payload_base64, res.bluetooth_name)
        toast.success('Boleta impresa')
        return
      }
      if (res?.status === 'FAILED') {
        toast.error(res?.error_message || 'No se pudo imprimir la boleta')
        return
      }
      toast.success('Boleta impresa')
    } catch (err) {
      if (err?.name === 'NotFoundError') {
        toast.info('Impresión de boleta cancelada')
        return
      }
      toast.error('No se pudo imprimir la boleta: ' + err.message)
    }
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    const orderId = activeOrder?.id
    setShowMPModal(false)
    setActiveOrder(null)
    setSelectedQtys({})
    setSuccessMsg('Venta registrada correctamente.')
    loadCatalog()
    if (orderId && isV2FeatureEnabled('receiptPrint')) printReceipt(orderId)
  }, [loadCatalog, activeOrder, printReceipt])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 p-4 lg:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-[hsl(var(--foreground))]">Venta directa</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Selecciona productos y cobra sin pasar por mesa.</p>
        </div>

        {(isV2FeatureEnabled('mpConfig') || isV2FeatureEnabled('printers')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isV2FeatureEnabled('mpConfig') && (
          <button
            onClick={() => setShowMPConfig(true)}
            className="min-h-[86px] rounded-2xl border border-[hsl(var(--border))] border-l-4 border-l-blue-700 bg-[hsl(var(--card))] px-4 py-3 text-left text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5 transition hover:bg-[hsl(var(--muted)/0.45)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
                <CreditCard size={23} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black uppercase tracking-wide">Configurar POS</span>
                <span className="mt-1 block text-xs font-semibold leading-snug text-[hsl(var(--muted-foreground))]">
                  Vincular MercadoPago Point y revisar terminales.
                </span>
              </span>
            </span>
          </button>
          )}
          {isV2FeatureEnabled('printers') && (
          <button
            onClick={() => setShowPrinterConfig(true)}
            className="min-h-[86px] rounded-2xl border border-[hsl(var(--border))] border-l-4 border-l-amber-700 bg-[hsl(var(--card))] px-4 py-3 text-left text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5 transition hover:bg-[hsl(var(--muted)/0.45)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-500/60"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm">
                <Printer size={23} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black uppercase tracking-wide">Impresora</span>
                <span className="mt-1 block text-xs font-semibold leading-snug text-[hsl(var(--muted-foreground))]">
                  Registrar ticketera, IP y prueba de conexión.
                </span>
              </span>
            </span>
          </button>
          )}
        </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMsg}<button className="ml-2 underline text-xs" onClick={() => setSuccessMsg('')}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No hay productos con stock disponible en este local.</p>
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
          total={activeOrder.total}
          description="Venta directa"
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowMPModal(false)}
        />
      )}

      {isV2FeatureEnabled('printers') && (
      <PrinterConfigModal
        open={showPrinterConfig}
        localId={localId}
        onClose={() => setShowPrinterConfig(false)}
      />
      )}

      {isV2FeatureEnabled('mpConfig') && (
      <MPConfigDrawer
        open={showMPConfig}
        localId={localId}
        onClose={() => setShowMPConfig(false)}
      />
      )}
    </div>
  )
}
