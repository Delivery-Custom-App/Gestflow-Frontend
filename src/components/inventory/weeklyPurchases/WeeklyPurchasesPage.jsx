import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getAuthContext } from '../../../lib/apiClient'
import {
  getLocalById,
  getSupplierDetailForBusiness,
  getSuppliersWithMetricsForBusiness,
} from '../../../lib/inventoryApi'
import {
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrders,
  postWeeklyPurchaseOrder,
} from '../../../lib/weeklyPurchasesApi'
import { isInventoryAdminRole } from '../../../utils/inventoryAccess'
import InventoryShell from '../InventoryShell'
import LoadingSpinner from '../../LoadingSpinner'
import '../../../styles/inventory/WeeklyPurchases.css'

function formatMoneyClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
  return `$${n}`
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

function NewWeeklyOrderModal({ open, businessId, localId, onClose, onCreated }) {
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [weekDate, setWeekDate] = useState(() => mondayOfWeekContaining(new Date().toISOString().slice(0, 10)))
  const [lines, setLines] = useState([])
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
        const rows = await getSuppliersWithMetricsForBusiness(token, businessId)
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
  }, [open, businessId])

  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setLines([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      setError('')
      try {
        const { token } = await getAuthContext()
        const detail = await getSupplierDetailForBusiness(token, supplierId, businessId)
        const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []
        const next = products.map((p) => ({
          product_id: p.product_id,
          product_name: p.name || String(p.product_id),
          quantity_ordered: 1,
          unit_price_clp: Math.max(0, Math.round(Number(p.unit_price_clp) || 0)),
          line_notes: null,
        }))
        if (!cancelled) setLines(next)
      } catch (e) {
        if (!cancelled) {
          setLines([])
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
    <div className="npmodal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal npmodal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-new-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="npmodal-head">
          <h2 id="wp-new-title">Nueva orden semanal</h2>
          <button type="button" className="npmodal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form className="npmodal-body wp-modal-grid" onSubmit={handleSubmit}>
          {error ? <p className="npmodal-error">{error}</p> : null}
          <label>
            Semana (cualquier día; se usará el lunes de esa semana)
            <input
              type="date"
              value={weekDate}
              onChange={(ev) => setWeekDate(ev.target.value)}
              required
            />
          </label>
          <label>
            Proveedor
            <select
              value={supplierId}
              onChange={(ev) => setSupplierId(ev.target.value)}
              required
              disabled={loadingSup}
            >
              <option value="">— Seleccionar —</option>
              {suppliers.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {s.name || s.id}
                </option>
              ))}
            </select>
          </label>

          {loadingProducts ? <p className="supplier-detail-loading">Cargando productos…</p> : null}

          {supplierId && lines.length === 0 && !loadingProducts ? (
            <p className="npmodal-error">
              Este proveedor no tiene productos con stock en inventario. Asocia productos al proveedor o usa otro.
            </p>
          ) : null}

          {lines.map((line, idx) => (
            <div key={String(line.product_id)} className="wp-line-row">
              <label>
                Producto
                <input type="text" readOnly value={line.product_name || line.product_id} title={String(line.product_id)} />
              </label>
              <label>
                Cant.
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={line.quantity_ordered}
                  onChange={(ev) => updateLine(idx, 'quantity_ordered', ev.target.value)}
                />
              </label>
              <label>
                Precio unit. CLP
                <input
                  type="number"
                  min="0"
                  value={line.unit_price_clp}
                  onChange={(ev) => updateLine(idx, 'unit_price_clp', ev.target.value)}
                />
              </label>
            </div>
          ))}

          <div className="npmodal-actions">
            <button type="button" className="npmodal-btn" onClick={onClose}>
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
      setSuppliers([])
      setSupplierNames({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { token } = await getAuthContext()
        const rows = await getSuppliersWithMetricsForBusiness(token, businessId)
        const list = Array.isArray(rows) ? rows : []
        if (cancelled) return
        setSuppliers(list)
        const map = {}
        for (const r of list) {
          if (r.id) map[String(r.id)] = r.name || String(r.id)
        }
        setSupplierNames(map)
      } catch {
        if (!cancelled) {
          setSuppliers([])
          setSupplierNames({})
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, canAccess])

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
    navigate(`/local/${localId}/inventario/compras-semanales/${orderId}`, {
      state: { local: selectedLocal },
    })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="weekly-purchases">
      <div className="inv-stock-page">
        <button
          type="button"
          className="scd-back-link"
          onClick={() => navigate(`/local/${localId}/inventario`, { state: { local: selectedLocal } })}
        >
          ← Volver al centro de inventario
        </button>

        <header className="scd-header scd-header--compact">
          <span className="scd-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M8 7V3h8v4M8 7h8M6 21h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <div>
            <h1 className="scd-title">Compras semanales (HU-34)</h1>
            <p className="scd-subtitle">Órdenes de compra por proveedor y semana; reporte comparativo</p>
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

            <div className="wp-toolbar">
              <label>
                Filtrar por semana (lunes)
                <input type="date" value={filterWeek} onChange={(ev) => setFilterWeek(ev.target.value)} />
              </label>
              <label>
                Proveedor
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
            />
          </>
        ) : null}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchasesPage
