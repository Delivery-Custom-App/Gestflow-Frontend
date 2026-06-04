import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSelectedLocal } from '../../../hooks/useSelectedLocal'
import { useLocalBusinessId } from '../../../hooks/useLocalBusinessId'
import {
  getSupplierDetailForBusiness,
  getSupplierPurchaseHistoryForBusiness,
  getSuppliersWithMetricsForBusiness,
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrders,
  postWeeklyPurchaseOrder,
} from '../../../lib/providersApi'
import { useAuth } from '../../../context/AuthContext'
import { formatCLPDisplay as formatMoneyClp } from '../../../lib/formatCLP'
import InventoryShell from '../InventoryShell'
import LoadingSpinner from '../../LoadingSpinner'
import ModernDateField from '../ModernDateField'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { CalendarDays, RefreshCw, AlertTriangle, Plus, Minus, X, Search, BarChart2 } from 'lucide-react'

const SUPPLIER_SEARCH_DEBOUNCE_MS = 350

function formatWeekLong(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return '—'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  } catch { return iso }
}

function formatReceivedCell(order) {
  const t = Number(order?.total_received_clp)
  if (Number.isFinite(t) && t > 0) return formatMoneyClp(t)
  return '—'
}

function linesFromSupplierDetail(detail) {
  const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []
  return products.map((p) => ({
    product_id: p.product_id,
    product_name: p.name || String(p.product_id),
    quantity_ordered: 1,
    unit_price_clp: Math.max(0, Math.round(Number(p.unit_price_clp) || 0)),
    line_notes: null,
  }))
}

function linesFromPurchaseHistory(history) {
  const products = Array.isArray(history?.products) ? history.products : []
  return products.map((p) => {
    const qty = Number(p.total_quantity_received) || 0
    const total = Number(p.total_amount_received_clp) || 0
    const avg = qty > 0 ? Math.round(total / qty) : 0
    return {
      product_id: p.product_id,
      product_name: p.product_name || String(p.product_id),
      quantity_ordered: 1,
      unit_price_clp: Math.max(0, avg),
      line_notes: null,
    }
  })
}

function mondayOfWeekContaining(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

const STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'Enviada',
  in_transit: 'En tránsito',
  partially_received: 'Recepción parcial',
  received: 'Recibida',
  cancelled: 'Anulada',
}

const STATUS_VARIANT = {
  draft: 'secondary',
  sent: 'info',
  in_transit: 'warning',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

/* ── Modal nueva orden ───────────────────────────────────────── */
function NewWeeklyOrderModal({ open, businessId, localId, onClose, onCreated }) {
  const [step,             setStep]             = useState('select') // 'select' | 'review'
  const [suppliers,        setSuppliers]        = useState([])
  const [supplierId,       setSupplierId]       = useState('')
  const [deliveryDate,     setDeliveryDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [availableProducts,setAvailableProducts]= useState([])
  const [pickerSelected,   setPickerSelected]   = useState(new Set())
  const [pickerSearch,     setPickerSearch]     = useState('')
  const [lines,            setLines]            = useState([])
  const [loadingSup,       setLoadingSup]       = useState(false)
  const [loadingProducts,  setLoadingProducts]  = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState('')

  /* ── Cargar proveedores al abrir ── */
  useEffect(() => {
    if (!open || !businessId) { setError(''); return }
    let cancelled = false
    ;(async () => {
      setLoadingSup(true)
      setError('')
      try {
        const rows = await getSuppliersWithMetricsForBusiness(businessId)
        if (!cancelled) setSuppliers(Array.isArray(rows) ? rows : [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar proveedores.')
      } finally {
        if (!cancelled) setLoadingSup(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, businessId])

  /* ── Reset al cerrar ── */
  useEffect(() => {
    if (!open) {
      setStep('select')
      setSupplierId('')
      setDeliveryDate(new Date().toISOString().slice(0, 10))
      setAvailableProducts([])
      setPickerSelected(new Set())
      setPickerSearch('')
      setLines([])
      setError('')
    }
  }, [open])

  /* ── Cargar productos al seleccionar proveedor ── */
  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setAvailableProducts([])
      setPickerSelected(new Set())
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      setError('')
      try {
        const [detail, history] = await Promise.all([
          getSupplierDetailForBusiness(supplierId, businessId).catch(() => null),
          getSupplierPurchaseHistoryForBusiness(supplierId, businessId).catch(() => null),
        ])
        if (cancelled) return
        const fromDetail = linesFromSupplierDetail(detail)
        const products   = fromDetail.length > 0 ? fromDetail : linesFromPurchaseHistory(history)
        setAvailableProducts(products)
        setPickerSelected(new Set())
      } catch (e) {
        if (!cancelled) { setAvailableProducts([]); setError(e?.message || 'No se pudieron cargar productos.') }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, supplierId, businessId])

  /* ── Helpers selección ── */
  const toggleProduct = (pid) =>
    setPickerSelected((prev) => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })

  const filteredProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return q ? availableProducts.filter((p) => (p.product_name || '').toLowerCase().includes(q)) : availableProducts
  }, [availableProducts, pickerSearch])

  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => pickerSelected.has(String(p.product_id)))
  const toggleAll   = () => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filteredProducts.forEach((p) => next.delete(String(p.product_id)))
      else              filteredProducts.forEach((p) => next.add(String(p.product_id)))
      return next
    })
  }

  /* ── Paso 1 → Paso 2 ── */
  const handleContinue = () => {
    if (pickerSelected.size === 0) { setError('Selecciona al menos un producto.'); return }
    setError('')
    const selected = availableProducts.filter((p) => pickerSelected.has(String(p.product_id)))
    setLines(selected.map((p) => ({ ...p, quantity_ordered: 1 })))
    setStep('review')
  }

  /* ── Líneas: qty ── */
  const changeQty = (idx, delta) =>
    setLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      copy[idx] = { ...copy[idx], quantity_ordered: Math.max(1, Math.round(Number(copy[idx].quantity_ordered) + delta)) }
      return copy
    })

  const setQtyDirect = (idx, raw) =>
    setLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      const n = parseInt(raw.replace(/\D/g, ''), 10)
      copy[idx] = { ...copy[idx], quantity_ordered: Number.isFinite(n) && n > 0 ? n : 1 }
      return copy
    })

  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const lineTotal  = (l) => Math.round(Number(l.quantity_ordered)) * Math.round(Number(l.unit_price_clp))
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0)

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!supplierId || !businessId) return
    const valid = lines.filter((l) => l.product_id && Number(l.quantity_ordered) > 0)
    if (!valid.length) { setError('Ajusta las cantidades antes de continuar.'); return }
    setSubmitting(true)
    setError('')
    try {
      const body = {
        business_id:     businessId,
        local_id:        localId || undefined,
        supplier_id:     supplierId,
        week_start_date: mondayOfWeekContaining(deliveryDate),
        items: valid.map((l) => ({
          product_id:       l.product_id,
          quantity_ordered: Math.round(Number(l.quantity_ordered)),
          unit_price_clp:   Math.max(0, Math.round(Number(l.unit_price_clp) || 0)),
          line_notes:       l.line_notes || undefined,
        })),
      }
      const created = await postWeeklyPurchaseOrder(body)
      onCreated(created)
      onClose()
    } catch (e) {
      setError(e?.message || 'No se pudo crear la orden.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectCls   = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'
  const colTemplate = '1fr 120px 100px 88px 32px'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 860px)' }}
        onInteractOutside={(e) => {
          const t = (e.detail?.originalEvent ?? e)?.target
          if (t instanceof Element && t.closest('[data-calendar-panel="true"]')) e.preventDefault()
        }}
      >
        {/* Header */}
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays size={18} aria-hidden="true" />
            Solicitud de Orden
          </DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {step === 'select'
              ? 'Ingresar datos necesarios para solicitud de nuevos productos'
              : 'Ajusta las cantidades y confirma el borrador'}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ════ PASO 1: Selección ════ */}
          {step === 'select' && (
            <div className="flex flex-col gap-5 px-7 py-5">
              {error && (
                <div className="flex gap-2 items-start rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" /><p>{error}</p>
                </div>
              )}

              {/* Proveedor + Día de entrega */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wp-modal-supplier">Proveedor <span className="text-red-500">*</span></Label>
                  <select
                    id="wp-modal-supplier"
                    value={supplierId}
                    onChange={(ev) => setSupplierId(ev.target.value)}
                    disabled={loadingSup}
                    className={selectCls}
                  >
                    <option value="">{loadingSup ? 'Cargando…' : '— Seleccionar —'}</option>
                    {suppliers.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>{s.name || s.id}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ModernDateField
                    id="wp-delivery-date"
                    label="Día de entrega de la solicitud"
                    value={deliveryDate}
                    onChange={(iso) => setDeliveryDate(iso || deliveryDate)}
                  />
                </div>
              </div>

              {/* Productos para solicitud */}
              {supplierId && (
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Productos para solicitud</h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Seleccione Productos del Proveedor</p>
                  </div>

                  {/* Loading */}
                  {loadingProducts && (
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] py-2">
                      <span className="w-4 h-4 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin shrink-0" />
                      Cargando productos del proveedor…
                    </div>
                  )}

                  {/* Sin productos */}
                  {!loadingProducts && availableProducts.length === 0 && (
                    <div className="flex gap-2 items-start rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">No hay productos en inventario ni historial para este proveedor.</p>
                    </div>
                  )}

                  {/* Lista de productos */}
                  {!loadingProducts && availableProducts.length > 0 && (
                    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">

                      {/* Buscador */}
                      <div className="px-3 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                          <input
                            type="search"
                            placeholder="Buscar producto…"
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            autoComplete="off"
                            className="h-8 w-full rounded-md border border-[hsl(var(--border))] bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.4)]"
                          />
                        </div>
                      </div>

                      {/* Seleccionar todos */}
                      {filteredProducts.length > 1 && (
                        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.15)]">
                          <input
                            type="checkbox"
                            id="sel-all"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded accent-[hsl(var(--primary))] cursor-pointer"
                          />
                          <label htmlFor="sel-all" className="text-xs font-medium text-[hsl(var(--muted-foreground))] cursor-pointer select-none">
                            Seleccionar todos ({filteredProducts.length})
                          </label>
                          {pickerSelected.size > 0 && (
                            <span className="ml-auto text-xs font-semibold text-[hsl(var(--primary))]">
                              {pickerSelected.size} seleccionado{pickerSelected.size !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Filas de productos */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-[hsl(var(--border)/0.3)] bg-white [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {filteredProducts.length === 0 ? (
                          <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">Sin resultados para "{pickerSearch}"</p>
                        ) : filteredProducts.map((p) => {
                          const pid     = String(p.product_id)
                          const checked = pickerSelected.has(pid)
                          return (
                            <label
                              key={pid}
                              htmlFor={`p-${pid}`}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                                checked
                                  ? 'bg-[hsl(var(--primary)/0.06)] border-l-2 border-l-[hsl(var(--primary))]'
                                  : 'hover:bg-[hsl(var(--accent)/0.4)] border-l-2 border-l-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                id={`p-${pid}`}
                                checked={checked}
                                onChange={() => toggleProduct(pid)}
                                className="h-4 w-4 rounded accent-[hsl(var(--primary))] shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium truncate ${checked ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]'}`}>
                                  {p.product_name}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] shrink-0 bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full">
                                {formatMoneyClp(p.unit_price_clp)} / u.
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ PASO 2: Revisión de cantidades ════ */}
          {step === 'review' && (
            <div className="flex flex-col gap-5 px-7 py-5">
              {error && (
                <div className="flex gap-2 items-start rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" /><p>{error}</p>
                </div>
              )}

              {/* Tabla de líneas */}
              <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                {/* Header */}
                <div
                  className="grid gap-2 px-4 py-2.5 bg-[hsl(var(--muted)/0.3)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  <span>Producto</span>
                  <span className="text-center">Cantidad</span>
                  <span className="text-right">Costo unit.</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {/* Filas */}
                <div className="divide-y divide-[hsl(var(--border)/0.4)] bg-white">
                  {lines.map((line, idx) => (
                    <div
                      key={String(line.product_id)}
                      className="grid items-center gap-2 px-4 py-3"
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      <span className="text-sm font-medium truncate" title={line.product_name}>{line.product_name}</span>

                      {/* Stepper */}
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => changeQty(idx, -1)}
                          disabled={Number(line.quantity_ordered) <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--accent))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={line.quantity_ordered}
                          onChange={(ev) => setQtyDirect(idx, ev.target.value)}
                          className="w-12 h-7 text-center rounded-md border border-[hsl(var(--border))] bg-white text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)]"
                        />
                        <button
                          type="button"
                          onClick={() => changeQty(idx, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--accent))] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="text-sm text-right text-[hsl(var(--muted-foreground))]">
                        {formatMoneyClp(line.unit_price_clp)}
                      </span>
                      <span className="text-sm text-right font-semibold text-[hsl(var(--foreground))]">
                        {formatMoneyClp(lineTotal(line))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="flex items-center justify-center w-7 h-7 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div
                  className="grid items-center gap-2 px-4 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide col-span-3 text-right">Total pedido</span>
                  <span className="text-sm font-bold text-right text-[hsl(var(--primary))]">{formatMoneyClp(grandTotal)}</span>
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0">
          {step === 'select' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                onClick={handleContinue}
                disabled={!supplierId || loadingProducts || pickerSelected.size === 0}
              >
                Continuar →
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => { setStep('select'); setError('') }}>
                ← Volver
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting || lines.length === 0}>
                {submitting ? 'Creando…' : 'Crear borrador'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Página principal ────────────────────────────────────────── */
function WeeklyPurchasesPage() {
  const { isInventoryAdmin: canAccess } = useAuth()
  const navigate = useNavigate()
  const { localId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedLocal = useSelectedLocal(localId)

  const [businessId, setBusinessId] = useState(null)
  const [businessIdLoading, setBusinessIdLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterWeek, setFilterWeek] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [supplierNames, setSupplierNames] = useState({})

  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [newModalOpen, setNewModalOpen] = useState(false)

  const [supplierSearchInput, setSupplierSearchInput] = useState(() => searchParams.get('search') || '')
  const [supplierSearchDebounced, setSupplierSearchDebounced] = useState(() => searchParams.get('search') || '')
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState(() => searchParams.get('category') || '')
  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState([])

  useEffect(() => {
    const id = setTimeout(() => setSupplierSearchDebounced(String(supplierSearchInput || '').trim()), SUPPLIER_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [supplierSearchInput])

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      supplierSearchDebounced ? next.set('search', supplierSearchDebounced) : next.delete('search')
      supplierCategoryFilter ? next.set('category', supplierCategoryFilter) : next.delete('category')
      return next
    }, { replace: true })
  }, [supplierSearchDebounced, supplierCategoryFilter, setSearchParams])

  const resolveBusiness = useLocalBusinessId(localId)

  const loadOrders = useCallback(async () => {
    if (!canAccess || !businessId) { setOrders([]); setLoading(false); return }
    setError('')
    setLoading(true)
    try {
      const filters = {}
      if (filterWeek) filters.week_start = mondayOfWeekContaining(filterWeek)
      if (filterSupplier) filters.supplier_id = filterSupplier
      if (filterStatus) filters.status = filterStatus
      const rows = await getWeeklyPurchaseOrders(businessId, filters)
      setOrders(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setOrders([])
      setError(e?.message || 'No se pudieron cargar las órdenes.')
    } finally {
      setLoading(false)
    }
  }, [businessId, canAccess, filterWeek, filterSupplier, filterStatus])

  useEffect(() => {
    if (!canAccess || !localId) { setBusinessId(null); setBusinessIdLoading(false); return }
    setBusinessIdLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        const bid = await resolveBusiness()
        if (!cancelled) setBusinessId(bid)
      } catch {
        if (!cancelled) setBusinessId(null)
      } finally {
        if (!cancelled) setBusinessIdLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [localId, canAccess, resolveBusiness])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    if (!businessId || !canAccess) { setSupplierCategoryOptions([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getSuppliersWithMetricsForBusiness(businessId)
        if (cancelled) return
        const set = new Set()
        for (const r of Array.isArray(rows) ? rows : []) {
          const c = r.category && String(r.category).trim()
          if (c) set.add(c)
        }
        setSupplierCategoryOptions([...set].sort((a, b) => a.localeCompare(b, 'es')))
      } catch {
        if (!cancelled) setSupplierCategoryOptions([])
      }
    })()
    return () => { cancelled = true }
  }, [businessId, canAccess])

  useEffect(() => {
    if (!businessId || !canAccess) { setSuppliers([]); setSupplierNames({}); return }
    let cancelled = false
    ;(async () => {
      try {
        const filters = {}
        if (supplierSearchDebounced) filters.search = supplierSearchDebounced
        if (supplierCategoryFilter) filters.category = supplierCategoryFilter
        const rows = await getSuppliersWithMetricsForBusiness(businessId, filters)
        const list = Array.isArray(rows) ? rows : []
        if (cancelled) return
        setSuppliers(list)
        setSupplierNames((prev) => {
          const next = { ...prev }
          for (const r of list) if (r.id) next[String(r.id)] = r.name || String(r.id)
          return next
        })
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => { cancelled = true }
  }, [businessId, canAccess, supplierSearchDebounced, supplierCategoryFilter])

  useEffect(() => {
    if (!filterSupplier) return
    if (!suppliers.some((s) => String(s.id) === String(filterSupplier))) setFilterSupplier('')
  }, [suppliers, filterSupplier])

  const loadReport = async () => {
    if (!businessId) return
    setReportLoading(true)
    setReportError('')
    try {
      const data = await getWeeklyPurchaseComparisonReport(
        businessId,
        mondayOfWeekContaining(reportFrom),
        mondayOfWeekContaining(reportTo),
      )
      setReportData(data)
    } catch (e) {
      setReportData(null)
      setReportError(e?.message || 'No se pudo cargar el reporte.')
    } finally {
      setReportLoading(false)
    }
  }

  const openDetail = (orderId) =>
    navigate(`/local/${localId}/inventario/compras-semanales/${orderId}`, { state: { local: selectedLocal } })

  const selectCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <InventoryShell>
      <div className="flex flex-col gap-6 px-6 py-6 pb-10">

        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              <CalendarDays size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Órdenes de compra semanales</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Planificá la compra por semana y proveedor, seguí el estado de cada orden.
              </p>
            </div>
          </div>
          {canAccess && !businessIdLoading && businessId && (
            <Button type="button" onClick={() => setNewModalOpen(true)} className="gap-1.5 shrink-0">
              <Plus size={16} />
              Nueva orden semanal
            </Button>
          )}
        </header>

        {!canAccess && (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            No tienes permisos para acceder a esta sección.
          </p>
        )}

        {canAccess && businessIdLoading && <LoadingSpinner message="Cargando datos del local…" />}

        {canAccess && !businessIdLoading && !businessId && (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
            No se pudo determinar el negocio del local.
          </p>
        )}

        {canAccess && !businessIdLoading && businessId && (
          <>
            {/* Filtros — todos en una sola Card */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                  {/* Buscar proveedor */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Buscar proveedor</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="search"
                        value={supplierSearchInput}
                        onChange={(ev) => setSupplierSearchInput(ev.target.value)}
                        placeholder="Nombre…"
                        autoComplete="off"
                        className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                      />
                    </div>
                  </div>

                  {/* Filtrar por semana */}
                  <div className="flex flex-col gap-1.5">
                    <ModernDateField
                      id="wp-filter-week"
                      label="Semana (lunes)"
                      value={filterWeek}
                      onChange={(iso) => setFilterWeek(iso || '')}
                    />
                  </div>

                  {/* Proveedor de la orden */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Proveedor</label>
                    <select value={filterSupplier} onChange={(ev) => setFilterSupplier(ev.target.value)} className={selectCls}>
                      <option value="">Todos</option>
                      {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name || s.id}</option>)}
                    </select>
                  </div>

                  {/* Estado */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Estado</label>
                    <select value={filterStatus} onChange={(ev) => setFilterStatus(ev.target.value)} className={selectCls}>
                      <option value="">Todos</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>

                  {/* Categoría */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Categoría</label>
                    <select value={supplierCategoryFilter} onChange={(ev) => setSupplierCategoryFilter(ev.target.value)} className={selectCls}>
                      <option value="">Todas</option>
                      {supplierCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error / listado */}
            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">{error}</p>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Listado de órdenes</CardTitle>
                    {!loading && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                        {orders.length} orden{orders.length === 1 ? '' : 'es'} encontrada{orders.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-0 pb-0">
                {loading ? (
                  <div className="py-8"><LoadingSpinner message="Cargando órdenes…" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Día de entrega</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Costo Estimado</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-[hsl(var(--muted-foreground))] py-10">
                              No hay órdenes con los filtros actuales.
                            </TableCell>
                          </TableRow>
                        ) : (
                          orders.map((o) => (
                            <TableRow key={String(o.id)}>
                              <TableCell className="font-medium">{formatWeekLong(o.week_start_date)}</TableCell>
                              <TableCell>{supplierNames[String(o.supplier_id)] || o.supplier_id || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>
                                  {STATUS_LABELS[o.status] || o.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatMoneyClp(o.total_estimated_clp)}</TableCell>
                              <TableCell className="text-right">
                                <Button type="button" variant="outline" size="sm" onClick={() => openDetail(o.id)}>
                                  Ver detalle →
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reporte comparativo */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <BarChart2 size={18} />
                  </span>
                  <div>
                    <CardTitle className="text-base">Reporte comparativo</CardTitle>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Comparación de órdenes entre rangos de semanas</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <ModernDateField
                    id="wp-report-from"
                    label="Desde (lunes)"
                    value={reportFrom}
                    onChange={(iso) => setReportFrom(iso || '')}
                  />
                  <ModernDateField
                    id="wp-report-to"
                    label="Hasta (lunes)"
                    value={reportTo}
                    onChange={(iso) => setReportTo(iso || '')}
                  />
                  <Button type="button" onClick={loadReport} disabled={reportLoading} className="self-end">
                    {reportLoading ? 'Generando…' : 'Generar reporte'}
                  </Button>
                </div>

                {reportError && (
                  <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">{reportError}</p>
                )}

                {reportData && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Por semana</p>
                      <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Semana</TableHead>
                              <TableHead>Órdenes</TableHead>
                              <TableHead>Total estimado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(reportData.by_week || []).map((w) => (
                              <TableRow key={w.week_start_date}>
                                <TableCell>{w.week_start_date}</TableCell>
                                <TableCell>{w.orders_count}</TableCell>
                                <TableCell>{formatMoneyClp(w.total_estimated_clp)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Por proveedor</p>
                      <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Órdenes</TableHead>
                              <TableHead>Total estimado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(reportData.by_supplier || []).map((s) => (
                              <TableRow key={String(s.supplier_id)}>
                                <TableCell>{s.supplier_name}</TableCell>
                                <TableCell>{s.orders_count}</TableCell>
                                <TableCell>{formatMoneyClp(s.total_estimated_clp)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <NewWeeklyOrderModal
              open={newModalOpen}
              businessId={businessId}
              localId={localId}
              onClose={() => setNewModalOpen(false)}
              onCreated={() => loadOrders()}
              supplierSearchDebounced={supplierSearchDebounced}
              supplierCategoryFilter={supplierCategoryFilter}
            />
          </>
        )}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchasesPage
