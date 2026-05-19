import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  getLocalById,
  getSupplierDetailForBusiness,
  deleteWeeklyPurchaseOrder,
  getWeeklyPurchaseOrder,
  patchWeeklyPurchaseLineReception,
  patchWeeklyPurchaseOrder,
  putWeeklyPurchaseOrderItems,
} from '../../../lib/providersApi'
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

function WeeklyPurchaseDetailPage({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId, orderId } = useParams()
  const location = useLocation()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const canAccess = isInventoryAdminRole(userRole)

  const [businessId, setBusinessId] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [supplierName, setSupplierName] = useState('')

  const [statusEdit, setStatusEdit] = useState('draft')
  const [savingStatus, setSavingStatus] = useState(false)

  const [draftLines, setDraftLines] = useState([])
  const [savingLines, setSavingLines] = useState(false)

  const [recvInputs, setRecvInputs] = useState({})

  const resolveBusiness = useCallback(async () => {
    if (!localId) return null
    const loc = await getLocalById(localId)
    return loc?.business_id != null ? String(loc.business_id) : null
  }, [localId])

  const load = useCallback(async () => {
    if (!orderId || !businessId) {
      setOrder(null)
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await getWeeklyPurchaseOrder(orderId, businessId)
      setOrder(data && typeof data === 'object' ? data : null)
      if (data?.status) setStatusEdit(data.status)
      const items = Array.isArray(data?.items) ? data.items : []
      setDraftLines(
        items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name_snapshot || it.product_id,
          quantity_ordered: it.quantity_ordered,
          unit_price_clp: it.unit_price_clp,
          line_notes: it.line_notes || null,
        })),
      )
      const recv = {}
      for (const it of items) {
        recv[String(it.id)] = String(it.quantity_received ?? '')
      }
      setRecvInputs(recv)
    } catch (e) {
      setOrder(null)
      setError(e?.message || 'No se pudo cargar la orden.')
    } finally {
      setLoading(false)
    }
  }, [orderId, businessId])

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
    load()
  }, [load])

  useEffect(() => {
    if (!order?.supplier_id || !businessId) {
      setSupplierName('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const detail = await getSupplierDetailForBusiness(order.supplier_id, businessId)
        if (!cancelled) setSupplierName(detail?.name ? String(detail.name) : String(order.supplier_id))
      } catch {
        if (!cancelled) setSupplierName(String(order.supplier_id))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [order?.supplier_id, businessId])

  const applyStatus = async () => {
    if (!businessId || !orderId) return
    setSavingStatus(true)
    setActionError('')
    try {
      const updated = await patchWeeklyPurchaseOrder(orderId, businessId, { status: statusEdit })
      setOrder(updated)
    } catch (e) {
      setActionError(e?.message || 'No se pudo actualizar el estado.')
    } finally {
      setSavingStatus(false)
    }
  }

  const saveDraftLines = async () => {
    if (!businessId || !orderId || order?.status !== 'draft') return
    setSavingLines(true)
    setActionError('')
    try {
      const items = draftLines
        .filter((l) => l.product_id && Number(l.quantity_ordered) > 0)
        .map((l) => ({
          product_id: l.product_id,
          quantity_ordered: Number(l.quantity_ordered),
          unit_price_clp: Math.max(0, Math.round(Number(l.unit_price_clp) || 0)),
          line_notes: l.line_notes || undefined,
        }))
      const updated = await putWeeklyPurchaseOrderItems(orderId, businessId, items)
      setOrder(updated)
    } catch (e) {
      setActionError(e?.message || 'No se pudieron guardar las líneas.')
    } finally {
      setSavingLines(false)
    }
  }

  const removeDraft = async () => {
    if (!businessId || !orderId || order?.status !== 'draft') return
    if (!window.confirm('¿Eliminar esta orden en borrador?')) return
    setActionError('')
    try {
      await deleteWeeklyPurchaseOrder(orderId, businessId)
      navigate(`/local/${localId}/inventario/compras-semanales`, { state: { local: selectedLocal } })
    } catch (e) {
      setActionError(e?.message || 'No se pudo eliminar.')
    }
  }

  const registerReception = async (itemId) => {
    if (!businessId || !orderId || !itemId) return
    const raw = recvInputs[String(itemId)]
    const qty = raw === '' || raw == null ? 0 : Number(raw)
    if (Number.isNaN(qty) || qty < 0) {
      setActionError('Cantidad recibida inválida.')
      return
    }
    setActionError('')
    try {
      const updated = await patchWeeklyPurchaseLineReception(orderId, itemId, businessId, qty)
      setOrder(updated)
      const items = Array.isArray(updated?.items) ? updated.items : []
      const recv = {}
      for (const it of items) {
        recv[String(it.id)] = String(it.quantity_received ?? '')
      }
      setRecvInputs(recv)
    } catch (e) {
      setActionError(e?.message || 'No se pudo registrar la recepción.')
    }
  }

  const updateDraftLine = (idx, field, value) => {
    setDraftLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="weekly-purchases">
      <div className="inv-stock-page">
        <button
          type="button"
          className="scd-back-link"
          onClick={() =>
            navigate(`/local/${localId}/inventario/compras-semanales`, { state: { local: selectedLocal } })
          }
        >
          ← Volver a compras semanales
        </button>

        <header className="scd-header scd-header--compact">
          <div>
            <h1 className="scd-title">Orden de compra semanal</h1>
            <p className="scd-subtitle">
              {order ? (
                <>
                  Semana (lunes): <strong>{order.week_start_date}</strong> · Proveedor:{' '}
                  <strong>{supplierName || order.supplier_id}</strong>
                </>
              ) : (
                'Cargando…'
              )}
            </p>
          </div>
        </header>

        {!canAccess ? <p className="npmodal-error">No tienes permisos.</p> : null}

        {actionError ? <p className="npmodal-error">{actionError}</p> : null}

        {loading ? <LoadingSpinner message="Cargando orden…" /> : null}

        {!loading && error ? <p className="npmodal-error">{error}</p> : null}

        {!loading && order && !error ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <span className={statusBadgeClass(order.status)}>{STATUS_LABELS[order.status] || order.status}</span>
              <span>Total estimado: {formatMoneyClp(order.total_estimated_clp)}</span>
            </div>

            <div className="wp-toolbar">
              <label>
                Cambiar estado
                <select value={statusEdit} onChange={(ev) => setStatusEdit(ev.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="wp-btn wp-btn--primary" onClick={() => applyStatus()} disabled={savingStatus}>
                {savingStatus ? 'Guardando…' : 'Guardar estado'}
              </button>
              {order.status === 'draft' ? (
                <button type="button" className="wp-btn wp-btn--danger" onClick={() => removeDraft()}>
                  Eliminar borrador
                </button>
              ) : null}
            </div>

            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Pedido</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                    {order.status !== 'draft' ? <th>Recibido</th> : null}
                    {order.status !== 'draft' ? <th>Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, idx) => (
                    <tr key={String(it.id)}>
                      <td>{it.product_name_snapshot || it.product_id || '—'}</td>
                      <td>
                        {order.status === 'draft' ? (
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={draftLines[idx]?.quantity_ordered ?? ''}
                            onChange={(ev) => updateDraftLine(idx, 'quantity_ordered', ev.target.value)}
                            onKeyDown={(ev) => ['e', 'E', '+', '-'].includes(ev.key) && ev.preventDefault()}
                          />
                        ) : (
                          it.quantity_ordered
                        )}
                      </td>
                      <td>
                        {order.status === 'draft' ? (
                          <input
                            type="number"
                            min="0"
                            value={draftLines[idx]?.unit_price_clp ?? ''}
                            onChange={(ev) => updateDraftLine(idx, 'unit_price_clp', ev.target.value)}
                            onKeyDown={(ev) => ['e', 'E', '+', '-'].includes(ev.key) && ev.preventDefault()}
                          />
                        ) : (
                          formatMoneyClp(it.unit_price_clp)
                        )}
                      </td>
                      <td>{formatMoneyClp(it.line_total_estimated_clp)}</td>
                      {order.status !== 'draft' ? (
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={recvInputs[String(it.id)] ?? ''}
                            onChange={(ev) =>
                              setRecvInputs((prev) => ({ ...prev, [String(it.id)]: ev.target.value }))
                            }
                            onKeyDown={(ev) => ['e', 'E', '+', '-'].includes(ev.key) && ev.preventDefault()}
                            aria-label="Cantidad recibida"
                          />
                        </td>
                      ) : null}
                      {order.status !== 'draft' ? (
                        <td>
                          <button type="button" className="wp-btn" onClick={() => registerReception(it.id)}>
                            Registrar
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {order.status === 'draft' ? (
              <div className="wp-actions">
                <button type="button" className="wp-btn wp-btn--primary" onClick={() => saveDraftLines()} disabled={savingLines}>
                  {savingLines ? 'Guardando líneas…' : 'Guardar líneas'}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchaseDetailPage
