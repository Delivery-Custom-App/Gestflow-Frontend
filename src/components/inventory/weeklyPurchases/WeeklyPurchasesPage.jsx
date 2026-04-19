import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { getAuthContext } from '../../../lib/apiClient'
import {
  getLocalById,
  getSupplierDetailForBusiness,
  getSupplierPurchaseHistoryForBusiness,
  getSuppliersWithMetricsForBusiness,
} from '../../../lib/inventoryApi'
import {
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrders,
  postWeeklyPurchaseOrder,
} from '../../../lib/weeklyPurchasesApi'
import { isInventoryAdminRole } from '../../../utils/inventoryAccess'
import InventoryShell from '../InventoryShell'
import SuppliersSubNav from '../SuppliersSubNav'
import LoadingSpinner from '../../LoadingSpinner'
import '../../../styles/inventory/WeeklyPurchases.css'

/** HU-85: espera antes de consultar API al escribir nombre de proveedor */
const SUPPLIER_SEARCH_DEBOUNCE_MS = 350

function formatMoneyClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
  return `$${n}`
}

/** Líneas iniciales del borrador desde catálogo/inventario (HU-69). */
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

/**
 * HU-84: si no hay filas en inventario, sugerir productos desde histórico de órdenes semanales (precio medio recibido).
 */
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

/** Lunes ISO de la semana que contiene la fecha YYYY-MM-DD */
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

function statusBadgeClass(status) {
  const s = String(status || 'draft')
  return `wp-badge wp-badge--${s.replace(/[^a-z_]/g, '_')}`
}

function NewWeeklyOrderModal({
  open,
  businessId,
  localId,
  onClose,
  onCreated,
  supplierSearchDebounced = '',
  supplierCategoryFilter = '',
}) {
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [weekDate, setWeekDate] = useState(() => mondayOfWeekContaining(new Date().toISOString().slice(0, 10)))
  const [lines, setLines] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState(null)
  const [loadingSup, setLoadingSup] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !businessId) return
    let cancelled = false
    ;(async () => {
      setLoadingSup(true)
      setError('')
      try {
        const { token } = await getAuthContext()
        const filters = {}
        if (supplierSearchDebounced && String(supplierSearchDebounced).trim()) {
          filters.search = String(supplierSearchDebounced).trim()
        }
        if (supplierCategoryFilter && String(supplierCategoryFilter).trim()) {
          filters.category = String(supplierCategoryFilter).trim()
        }
        const rows = await getSuppliersWithMetricsForBusiness(token, businessId, filters)
        if (!cancelled) setSuppliers(Array.isArray(rows) ? rows : [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar proveedores.')
      } finally {
        if (!cancelled) setLoadingSup(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, businessId, supplierSearchDebounced, supplierCategoryFilter])

  useEffect(() => {
    if (!supplierId) return
    const ok = suppliers.some((s) => String(s.id) === String(supplierId))
    if (!ok) setSupplierId('')
  }, [suppliers, supplierId])

  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setLines([])
      setPurchaseHistory(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      setError('')
      setPurchaseHistory(null)
      try {
        const { token } = await getAuthContext()
        const [detail, history] = await Promise.all([
          getSupplierDetailForBusiness(token, supplierId, businessId).catch(() => null),
          getSupplierPurchaseHistoryForBusiness(token, supplierId, businessId).catch(() => null),
        ])
        if (cancelled) return
        setPurchaseHistory(history && typeof history === 'object' ? history : null)
        const fromDetail = linesFromSupplierDetail(detail)
        if (fromDetail.length > 0) {
          setLines(fromDetail)
        } else {
          setLines(linesFromPurchaseHistory(history))
        }
      } catch (e) {
        if (!cancelled) {
          setLines([])
          setPurchaseHistory(null)
          setError(e?.message || 'No se pudieron cargar productos del proveedor.')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, supplierId, businessId])

  const updateLine = (idx, field, value) => {
    setLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!supplierId || !businessId) return
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity_ordered) > 0)
    if (validLines.length === 0) {
      setError('Agrega al menos una línea con cantidad mayor a cero.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { token } = await getAuthContext()
      const weekStart = mondayOfWeekContaining(weekDate)
      const body = {
        business_id: businessId,
        local_id: localId || undefined,
        supplier_id: supplierId,
        week_start_date: weekStart,
        items: validLines.map((l) => ({
          product_id: l.product_id,
          quantity_ordered: Number(l.quantity_ordered),
          unit_price_clp: Math.max(0, Math.round(Number(l.unit_price_clp) || 0)),
          line_notes: l.line_notes || undefined,
        })),
      }
      const created = await postWeeklyPurchaseOrder(token, body)
      onCreated(created)
      onClose()
    } catch (e) {
      setError(e?.message || 'No se pudo crear la orden.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="npmodal-backdrop wp-new-order-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal npmodal--wide wp-new-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-new-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="npmodal-head wp-new-order-head">
          <div className="wp-new-order-head__main">
            <div className="wp-new-order-head__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 7V3h8v4M8 7h8M6 21h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path d="M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="wp-new-order-head__titles">
              <h2 id="wp-new-title">Nueva orden semanal</h2>
              <p className="wp-new-order-head__subtitle">Planificá la compra por semana y proveedor en un solo paso.</p>
            </div>
          </div>
          <button type="button" className="npmodal-close wp-new-order-close" onClick={onClose} aria-label="Cerrar">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="npmodal-form wp-new-order-form" onSubmit={handleSubmit}>
          {error ? (
            <div className="wp-new-order-alert wp-new-order-alert--error" role="alert">
              <span className="wp-new-order-alert__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path
                    d="M12 9v4m0 4h.01M10.3 3.6L2.2 18.4A1 1 0 003.1 20h17.8a1 1 0 00.9-1.6L13.7 3.6a1 1 0 00-1.8 0z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <p>{error}</p>
            </div>
          ) : null}

          <div className="npmodal-row npmodal-row--2 wp-new-order-row">
            <label className="npmodal-field">
              <span>Semana de compra</span>
              <span className="wp-new-order-field-hint">Cualquier día del calendario; se usará el lunes de esa semana.</span>
              <input
                type="date"
                value={weekDate}
                onChange={(ev) => setWeekDate(ev.target.value)}
                required
              />
            </label>
            <label className="npmodal-field">
              <span>Proveedor</span>
              <span className="wp-new-order-field-hint">
                Mismo criterio que arriba: búsqueda por nombre y categoría en la página.
              </span>
              <select
                value={supplierId}
                onChange={(ev) => setSupplierId(ev.target.value)}
                required
                disabled={loadingSup}
              >
                <option value="">{loadingSup ? 'Cargando…' : '— Seleccionar —'}</option>
                {suppliers.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name || s.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingProducts ? (
            <div className="wp-new-order-loading" aria-live="polite">
              <span className="wp-new-order-loading__pulse" />
              <span>Cargando catálogo e historial de compras…</span>
            </div>
          ) : null}

          {supplierId && !loadingProducts && Array.isArray(purchaseHistory?.products) && purchaseHistory.products.length > 0 ? (
            <div className="wp-new-order-history" aria-labelledby="wp-history-title">
              <div className="wp-new-order-history__head">
                <h3 id="wp-history-title">Productos comprados (historial)</h3>
                <span className="wp-new-order-history__badge">HU-84 · órdenes semanales recibidas</span>
              </div>
              <p className="wp-new-order-history__hint">
                Referencia por producto: última semana con actividad, cantidad total recibida y monto en compras ya
                recepcionadas.
              </p>
              <div className="wp-new-order-history__table-wrap">
                <table className="wp-new-order-history__table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Última compra (lunes)</th>
                      <th>Cant. recibida</th>
                      <th>Valor unit. (prom.)</th>
                      <th>Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseHistory.products.map((row) => {
                      const qty = Number(row.total_quantity_received) || 0
                      const total = Number(row.total_amount_received_clp) || 0
                      const unitAvg = qty > 0 ? Math.round(total / qty) : null
                      return (
                      <tr key={String(row.product_id)}>
                        <td>{row.product_name || row.product_id}</td>
                        <td>{row.last_purchase_week_start_date || '—'}</td>
                        <td>
                          {row.total_quantity_received != null
                            ? Number(row.total_quantity_received).toLocaleString('es-CL', { maximumFractionDigits: 2 })
                            : '—'}
                        </td>
                        <td>{unitAvg != null ? formatMoneyClp(unitAvg) : '—'}</td>
                        <td>{formatMoneyClp(row.total_amount_received_clp)}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {supplierId && lines.length === 0 && !loadingProducts ? (
            <div className="wp-new-order-callout" role="status">
              <span className="wp-new-order-callout__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path
                    d="M12 16v-4m0-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <strong>Sin líneas para el borrador</strong>
                <p>
                  No hay productos con stock en inventario ni historial de compras semanales para este proveedor.
                  Asociá productos al proveedor, registrá recepciones en órdenes previas o elegí otro proveedor.
                </p>
              </div>
            </div>
          ) : null}

          {lines.length > 0 ? (
            <div className="wp-new-order-lines">
              <div className="wp-new-order-lines__head">
                <h3 className="wp-new-order-lines__title">Líneas del pedido</h3>
                <span className="wp-new-order-lines__badge">{lines.length} producto{lines.length === 1 ? '' : 's'}</span>
              </div>
              {lines.map((line, idx) => (
                <div key={String(line.product_id)} className="wp-line-row wp-new-order-line">
                  <label className="npmodal-field wp-new-order-line__product">
                    <span>Producto</span>
                    <input
                      type="text"
                      readOnly
                      value={line.product_name || line.product_id}
                      title={String(line.product_id)}
                    />
                  </label>
                  <label className="npmodal-field">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={line.quantity_ordered}
                      onChange={(ev) => updateLine(idx, 'quantity_ordered', ev.target.value)}
                    />
                  </label>
                  <label className="npmodal-field">
                    <span>Precio unit. CLP</span>
                    <input
                      type="number"
                      min="0"
                      value={line.unit_price_clp}
                      onChange={(ev) => updateLine(idx, 'unit_price_clp', ev.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          <div className="npmodal-actions wp-new-order-actions">
            <button type="button" className="npmodal-btn npmodal-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="npmodal-btn npmodal-btn--primary" disabled={submitting || !supplierId}>
              {submitting ? 'Creando…' : 'Crear borrador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WeeklyPurchasesPage({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const canAccess = isInventoryAdminRole(userRole)

  const [businessId, setBusinessId] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterWeek, setFilterWeek] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [supplierNames, setSupplierNames] = useState({})

  const [reportFrom, setReportFrom] = useState(() => mondayOfWeekContaining(new Date().toISOString().slice(0, 10)))
  const [reportTo, setReportTo] = useState(() => mondayOfWeekContaining(new Date().toISOString().slice(0, 10)))
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [newModalOpen, setNewModalOpen] = useState(false)

  const [supplierSearchInput, setSupplierSearchInput] = useState(() => searchParams.get('search') || '')
  const [supplierSearchDebounced, setSupplierSearchDebounced] = useState(() => searchParams.get('search') || '')
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState(() => searchParams.get('category') || '')
  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState([])

  useEffect(() => {
    const id = setTimeout(() => {
      setSupplierSearchDebounced(String(supplierSearchInput || '').trim())
    }, SUPPLIER_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [supplierSearchInput])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (supplierSearchDebounced) next.set('search', supplierSearchDebounced)
        else next.delete('search')
        if (supplierCategoryFilter) next.set('category', supplierCategoryFilter)
        else next.delete('category')
        return next
      },
      { replace: true },
    )
  }, [supplierSearchDebounced, supplierCategoryFilter, setSearchParams])

  const resolveBusiness = useCallback(async () => {
    if (!localId) return null
    const { token } = await getAuthContext()
    const loc = await getLocalById(localId, token)
    return loc?.business_id != null ? String(loc.business_id) : null
  }, [localId])

  const loadOrders = useCallback(async () => {
    if (!canAccess || !businessId) {
      setOrders([])
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token } = await getAuthContext()
      const filters = {}
      if (filterWeek) filters.week_start = mondayOfWeekContaining(filterWeek)
      if (filterSupplier) filters.supplier_id = filterSupplier
      if (filterStatus) filters.status = filterStatus
      const rows = await getWeeklyPurchaseOrders(token, businessId, filters)
      setOrders(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setOrders([])
      setError(e?.message || 'No se pudieron cargar las órdenes semanales.')
    } finally {
      setLoading(false)
    }
  }, [businessId, canAccess, filterWeek, filterSupplier, filterStatus])

  useEffect(() => {
    if (!canAccess || !localId) {
      setBusinessId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const bid = await resolveBusiness()
        if (!cancelled) setBusinessId(bid)
      } catch {
        if (!cancelled) setBusinessId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [localId, canAccess, resolveBusiness])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!businessId || !canAccess) {
      setSupplierCategoryOptions([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { token } = await getAuthContext()
        const rows = await getSuppliersWithMetricsForBusiness(token, businessId)
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
    return () => {
      cancelled = true
    }
  }, [businessId, canAccess])

  useEffect(() => {
    if (businessId) setSupplierNames({})
  }, [businessId])

  useEffect(() => {
    if (!businessId || !canAccess) {
      setSuppliers([])
      setSupplierNames({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { token } = await getAuthContext()
        const filters = {}
        if (supplierSearchDebounced) filters.search = supplierSearchDebounced
        if (supplierCategoryFilter) filters.category = supplierCategoryFilter
        const rows = await getSuppliersWithMetricsForBusiness(token, businessId, filters)
        const list = Array.isArray(rows) ? rows : []
        if (cancelled) return
        setSuppliers(list)
        setSupplierNames((prev) => {
          const next = { ...prev }
          for (const r of list) {
            if (r.id) next[String(r.id)] = r.name || String(r.id)
          }
          return next
        })
      } catch {
        if (!cancelled) {
          setSuppliers([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, canAccess, supplierSearchDebounced, supplierCategoryFilter])

  useEffect(() => {
    if (!filterSupplier) return
    const ok = suppliers.some((s) => String(s.id) === String(filterSupplier))
    if (!ok) setFilterSupplier('')
  }, [suppliers, filterSupplier])

  const loadReport = async () => {
    if (!businessId) return
    setReportLoading(true)
    setReportError('')
    try {
      const { token } = await getAuthContext()
      const wf = mondayOfWeekContaining(reportFrom)
      const wt = mondayOfWeekContaining(reportTo)
      const data = await getWeeklyPurchaseComparisonReport(token, businessId, wf, wt)
      setReportData(data)
    } catch (e) {
      setReportData(null)
      setReportError(e?.message || 'No se pudo cargar el reporte.')
    } finally {
      setReportLoading(false)
    }
  }

  const openDetail = (orderId) => {
    navigate(`/local/${localId}/inventario/proveedores/compras-semanales/${orderId}`, {
      state: { local: selectedLocal },
    })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="suppliers">
      <div className="inv-stock-page">
        <button
          type="button"
          className="scd-back-link"
          onClick={() => navigate(`/local/${localId}/inventario`, { state: { local: selectedLocal } })}
        >
          ← Volver al centro de inventario
        </button>

        <SuppliersSubNav navState={{ local: selectedLocal }} />

        <header className="scd-header scd-header--compact">
          <span className="scd-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M8 7V3h8v4M8 7h8M6 21h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <div>
            <h1 className="scd-title">Compras semanales</h1>
            <p className="scd-subtitle">
              Dentro de Proveedores · órdenes por proveedor y semana; reporte comparativo (HU-34)
            </p>
          </div>
        </header>

        {!canAccess ? (
          <p className="npmodal-error">No tienes permisos para acceder a esta sección.</p>
        ) : null}

        {canAccess && !businessId ? (
          <p className="npmodal-error">No se pudo determinar el negocio del local.</p>
        ) : null}

        {canAccess && businessId ? (
          <>
            <div className="wp-actions">
              <button type="button" className="wp-btn wp-btn--primary" onClick={() => setNewModalOpen(true)}>
                + Nueva orden semanal
              </button>
              <button type="button" className="wp-btn" onClick={() => loadOrders()}>
                Actualizar listado
              </button>
            </div>

            <div className="wp-toolbar wp-toolbar--supplier-filters" aria-label="Filtro del catálogo de proveedores">
              <label>
                Buscar proveedor
                <input
                  type="search"
                  value={supplierSearchInput}
                  onChange={(ev) => setSupplierSearchInput(ev.target.value)}
                  placeholder="Nombre (coincidencia parcial)"
                  autoComplete="off"
                />
              </label>
              <label>
                Categoría (proveedor)
                <select
                  value={supplierCategoryFilter}
                  onChange={(ev) => setSupplierCategoryFilter(ev.target.value)}
                >
                  <option value="">Todas</option>
                  {supplierCategoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="wp-toolbar">
              <label>
                Filtrar por semana (lunes)
                <input type="date" value={filterWeek} onChange={(ev) => setFilterWeek(ev.target.value)} />
              </label>
              <label>
                Proveedor (orden)
                <select value={filterSupplier} onChange={(ev) => setFilterSupplier(ev.target.value)}>
                  <option value="">Todos</option>
                  {suppliers.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select value={filterStatus} onChange={(ev) => setFilterStatus(ev.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="npmodal-error">{error}</p> : null}

            {loading ? (
              <LoadingSpinner message="Cargando órdenes…" />
            ) : (
              <div className="wp-table-wrap">
                <table className="wp-table">
                  <thead>
                    <tr>
                      <th>Semana (lunes)</th>
                      <th>Proveedor</th>
                      <th>Estado</th>
                      <th>Total estimado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          No hay órdenes con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={String(o.id)}>
                          <td>{o.week_start_date || '—'}</td>
                          <td>{supplierNames[String(o.supplier_id)] || o.supplier_id || '—'}</td>
                          <td>
                            <span className={statusBadgeClass(o.status)}>{STATUS_LABELS[o.status] || o.status}</span>
                          </td>
                          <td>{formatMoneyClp(o.total_estimated_clp)}</td>
                          <td>
                            <button type="button" className="wp-btn" onClick={() => openDetail(o.id)}>
                              Ver / editar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <section className="wp-section" aria-labelledby="wp-report-title">
              <h3 id="wp-report-title">Reporte comparativo</h3>
              <div className="wp-toolbar">
                <label>
                  Desde (lunes)
                  <input type="date" value={reportFrom} onChange={(ev) => setReportFrom(ev.target.value)} />
                </label>
                <label>
                  Hasta (lunes)
                  <input type="date" value={reportTo} onChange={(ev) => setReportTo(ev.target.value)} />
                </label>
                <button type="button" className="wp-btn wp-btn--primary" onClick={() => loadReport()} disabled={reportLoading}>
                  {reportLoading ? 'Generando…' : 'Generar'}
                </button>
              </div>
              {reportError ? <p className="npmodal-error">{reportError}</p> : null}
              {reportData ? (
                <>
                  <div className="wp-table-wrap" style={{ marginBottom: '1rem' }}>
                    <table className="wp-table">
                      <thead>
                        <tr>
                          <th>Semana</th>
                          <th>Órdenes</th>
                          <th>Total estimado (CLP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.by_week || []).map((w) => (
                          <tr key={w.week_start_date}>
                            <td>{w.week_start_date}</td>
                            <td>{w.orders_count}</td>
                            <td>{formatMoneyClp(w.total_estimated_clp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="wp-table-wrap">
                    <table className="wp-table">
                      <thead>
                        <tr>
                          <th>Proveedor</th>
                          <th>Órdenes</th>
                          <th>Total estimado (CLP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.by_supplier || []).map((s) => (
                          <tr key={String(s.supplier_id)}>
                            <td>{s.supplier_name}</td>
                            <td>{s.orders_count}</td>
                            <td>{formatMoneyClp(s.total_estimated_clp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>

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
        ) : null}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchasesPage
