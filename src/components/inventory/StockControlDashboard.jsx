import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getAuthContext } from '../../lib/apiClient'
import { getInventoryKpisByLocal } from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import NuevoProductoModal from './NuevoProductoModal'
import '../../styles/inventory/StockControlDashboard.css'

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value))
}

/** HU-41 + HU-49: KPIs en una fila + tabla placeholder + modal nuevo producto */
function StockControlDashboard({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setError('')
    try {
      const { token } = await getAuthContext()
      const payload = await getInventoryKpisByLocal(localId, token)
      setData(payload)
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los KPIs de inventario.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    load()
  }, [load])

  const backToHub = () => {
    navigate(`/local/${localId}/inventario`, { state: { local: selectedLocal } })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="stock">
      <button type="button" className="scd-back" onClick={backToHub}>
        ← Volver al dashboard de inventario
      </button>

      <header className="scd-header">
        <span className="scd-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <div>
          <h1 className="scd-title">Control de stock</h1>
          <p className="scd-subtitle">Inventario de productos · HU-41 · HU-49</p>
        </div>
      </header>

      {error ? <div className="scd-status scd-status--error">{error}</div> : null}
      {!error && loading && !data ? <div className="scd-status">Cargando indicadores…</div> : null}

      {data ? (
        <section className="scd-kpis" aria-label="KPIs de inventario">
          <article className="scd-kpi">
            <span className="scd-kpi-icon scd-kpi-icon--box" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <div>
              <p className="scd-kpi-label">Total productos</p>
              <p className="scd-kpi-value">{data.total_products ?? 0}</p>
            </div>
          </article>
          <article className="scd-kpi scd-kpi--critical">
            <span className="scd-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01M10.3 3.6L2.2 18.4A1 1 0 003.1 20h17.8a1 1 0 00.9-1.6L13.7 3.6a1 1 0 00-1.8 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="scd-kpi-label">Stock crítico</p>
              <p className="scd-kpi-value">{data.critical_stock_count ?? 0}</p>
            </div>
          </article>
          <article className="scd-kpi scd-kpi--low">
            <span className="scd-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="scd-kpi-label">Stock bajo</p>
              <p className="scd-kpi-value">{data.low_stock_count ?? 0}</p>
            </div>
          </article>
          <article className="scd-kpi scd-kpi--value">
            <span className="scd-kpi-icon scd-kpi-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="scd-kpi-label">Valor total</p>
              <p className="scd-kpi-value scd-kpi-value--money">{formatMoney(data.total_value)}</p>
            </div>
          </article>
        </section>
      ) : null}

      <section className="scd-panel" aria-labelledby="scd-inventory-heading">
        <div className="scd-panel-head">
          <h2 id="scd-inventory-heading">Inventario de productos</h2>
          <button type="button" className="scd-btn-new" onClick={() => setModalOpen(true)}>
            + Nuevo producto
          </button>
        </div>

        <div className="scd-filters">
          <div className="scd-search">
            <span className="scd-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input type="search" placeholder="Buscar productos…" disabled aria-disabled="true" />
          </div>
          <select className="scd-select" disabled aria-disabled="true">
            <option>Todas las categorías</option>
          </select>
          <select className="scd-select" disabled aria-disabled="true">
            <option>Todos los estados</option>
          </select>
        </div>

        <div className="scd-table-wrap">
          <table className="scd-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock actual</th>
                <th>Stock mín.</th>
                <th>Costo unit.</th>
                <th>Valor total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="scd-table-empty">
                  La tabla de productos se conectará al listado del backend en una siguiente historia.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <NuevoProductoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </InventoryShell>
  )
}

export default StockControlDashboard
