import { useCallback, useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { getSupplierDetailForBusiness, patchSupplier } from '../../lib/inventoryApi'
import '../../styles/inventory/WeeklyPurchases.css'

function formatMoneyClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
  return `$${n}`
}

function displayStr(value) {
  const s = value != null ? String(value).trim() : ''
  return s || '—'
}

/**
 * Modal de detalle de proveedor (HU-69): datos de contacto, KPIs y productos en inventario.
 */
function SupplierDetailModal({ open, supplierId, businessId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [commercialSaving, setCommercialSaving] = useState(false)
  const [commercialError, setCommercialError] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [commercialNotes, setCommercialNotes] = useState('')

  const load = useCallback(async () => {
    if (!supplierId || !businessId) return
    setError('')
    setLoading(true)
    setDetail(null)
    try {
      const { token } = await getAuthContext()
      const data = await getSupplierDetailForBusiness(token, supplierId, businessId)
      setDetail(data && typeof data === 'object' ? data : null)
      if (data && typeof data === 'object') {
        setPaymentTerms(data.payment_terms_days != null ? String(data.payment_terms_days) : '')
        setLeadTime(data.delivery_lead_time_days != null ? String(data.delivery_lead_time_days) : '')
        setCommercialNotes(data.commercial_notes != null ? String(data.commercial_notes) : '')
      }
    } catch (e) {
      setDetail(null)
      setError(e?.message || 'No se pudo cargar el detalle del proveedor.')
    } finally {
      setLoading(false)
    }
  }, [supplierId, businessId])

  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setDetail(null)
      setError('')
      setLoading(false)
      return
    }
    load()
  }, [open, supplierId, businessId, load])

  useEffect(() => {
    if (!open) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !supplierId || !businessId) return null

  const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []

  const saveCommercial = async (ev) => {
    ev.preventDefault()
    setCommercialError('')
    setCommercialSaving(true)
    try {
      const { token } = await getAuthContext()
      const body = {}
      if (paymentTerms.trim() !== '') {
        const n = parseInt(paymentTerms, 10)
        if (!Number.isFinite(n) || n < 0) throw new Error('Plazo de pago inválido.')
        body.payment_terms_days = n
      } else {
        body.payment_terms_days = null
      }
      if (leadTime.trim() !== '') {
        const n = parseInt(leadTime, 10)
        if (!Number.isFinite(n) || n < 0) throw new Error('Plazo de entrega inválido.')
        body.delivery_lead_time_days = n
      } else {
        body.delivery_lead_time_days = null
      }
      body.commercial_notes = commercialNotes.trim() || null
      const updated = await patchSupplier(token, supplierId, businessId, body)
      setDetail((prev) => (prev && typeof prev === 'object' ? { ...prev, ...updated } : updated))
    } catch (e) {
      setCommercialError(e?.message || 'No se pudieron guardar las condiciones.')
    } finally {
      setCommercialSaving(false)
    }
  }

  return (
    <div className="npmodal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal npmodal--wide supplier-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-detail-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="npmodal-head">
          <h2 id="supplier-detail-title">Detalle del proveedor</h2>
          <button type="button" className="npmodal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="supplier-detail-body">
          {loading ? (
            <p className="supplier-detail-loading" role="status">
              Cargando…
            </p>
          ) : null}

          {error ? <p className="npmodal-error">{error}</p> : null}

          {!loading && !error && detail ? (
            <>
              <div className="supplier-detail-headline">
                <h3 className="supplier-detail-name">{displayStr(detail.name)}</h3>
                <span className={`supplier-detail-badge ${detail.is_active === false ? 'is-inactive' : ''}`}>
                  {detail.is_active === false ? 'Inactivo' : 'Activo'}
                </span>
              </div>

              <dl className="supplier-detail-dl">
                <dt>RUT</dt>
                <dd>{displayStr(detail.rut)}</dd>
                <dt>Teléfono</dt>
                <dd>{displayStr(detail.phone)}</dd>
                <dt>Email</dt>
                <dd>{displayStr(detail.email)}</dd>
                <dt>Dirección</dt>
                <dd>{displayStr(detail.address)}</dd>
                <dt>Contacto</dt>
                <dd>{displayStr(detail.contact_name)}</dd>
                <dt>Categoría</dt>
                <dd>{displayStr(detail.category)}</dd>
              </dl>

              <form className="supplier-detail-commercial-form supplier-detail-commercial" onSubmit={saveCommercial}>
                <h4>Condiciones comerciales (HU-34)</h4>
                {commercialError ? <p className="npmodal-error">{commercialError}</p> : null}
                <label>
                  Plazo de pago (días)
                  <input
                    type="number"
                    min="0"
                    value={paymentTerms}
                    onChange={(ev) => setPaymentTerms(ev.target.value)}
                    placeholder="Ej. 30"
                  />
                </label>
                <label>
                  Plazo de entrega típico (días)
                  <input
                    type="number"
                    min="0"
                    value={leadTime}
                    onChange={(ev) => setLeadTime(ev.target.value)}
                    placeholder="Ej. 3"
                  />
                </label>
                <label>
                  Observaciones
                  <textarea value={commercialNotes} onChange={(ev) => setCommercialNotes(ev.target.value)} placeholder="Condiciones u notas" />
                </label>
                <button type="submit" className="npmodal-btn npmodal-btn--primary" disabled={commercialSaving}>
                  {commercialSaving ? 'Guardando…' : 'Guardar condiciones'}
                </button>
              </form>

              <div className="supplier-detail-kpis" aria-label="Indicadores">
                <div className="supplier-detail-kpi">
                  <span className="supplier-detail-kpi-label">Total productos (unidades)</span>
                  <span className="supplier-detail-kpi-value">{detail.purchased_products_count ?? 0}</span>
                </div>
                <div className="supplier-detail-kpi">
                  <span className="supplier-detail-kpi-label">Total compras (CLP)</span>
                  <span className="supplier-detail-kpi-value supplier-detail-kpi-value--money">
                    {formatMoneyClp(detail.supplier_purchases_total_clp)}
                  </span>
                </div>
              </div>

              <h4 className="supplier-detail-subtitle">Productos en inventario</h4>
              {products.length === 0 ? (
                <p className="supplier-detail-empty-products">No hay productos asociados o sin stock registrado.</p>
              ) : (
                <div className="supplier-detail-table-wrap">
                  <table className="supplier-detail-products-table">
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col" className="supplier-detail-num">
                          Cantidad
                        </th>
                        <th scope="col" className="supplier-detail-num">
                          Costo unit. (CLP)
                        </th>
                        <th scope="col" className="supplier-detail-num">
                          Subtotal (CLP)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={String(p.product_id)}>
                          <td>{displayStr(p.name)}</td>
                          <td className="supplier-detail-num">{p.quantity ?? 0}</td>
                          <td className="supplier-detail-num">{formatMoneyClp(p.unit_price_clp)}</td>
                          <td className="supplier-detail-num">{formatMoneyClp(p.line_total_clp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          <div className="npmodal-actions supplier-detail-actions">
            <button type="button" className="npmodal-btn npmodal-btn--primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupplierDetailModal
