import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getAuthContext } from '../../lib/apiClient'
import { getInventoryStockList } from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import { getStockAlertLevel } from './stockAlertUtils'

function InventoryHub({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()
  
  console.log('InventoryHub - localId:', localId, 'location.pathname:', location.pathname)

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const [items, setItems] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)

  const loadAlerts = useCallback(async () => {
    if (!localId) {
      setItems([])
      setAlertsLoading(false)
      return
    }
    setAlertsLoading(true)
    try {
      const { token } = await getAuthContext()
      const payload = await getInventoryStockList(localId, token)
      setItems(Array.isArray(payload) ? payload : [])
    } catch {
      setItems([])
    } finally {
      setAlertsLoading(false)
    }
  }, [localId])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const alerts = useMemo(() => {
    const rows = []
    for (const row of items) {
      const level = getStockAlertLevel(row)
      if (!level) continue
      const stock = Number(row.stock_current ?? 0)
      const min = row.stock_min != null ? Number(row.stock_min) : '—'
      rows.push({
        id: row.inventory_id ?? row.product_id,
        name: row.product_name || row.name || 'Producto',
        level,
        detail: `Stock actual: ${stock} | Mínimo: ${min}`,
      })
    }
    rows.sort((a, b) => (a.level === 'critical' ? -1 : b.level === 'critical' ? 1 : 0))
    return rows.slice(0, 6)
  }, [items])

  const openStock = () => {
    navigate(`/local/${localId}/inventario/stock`, { state: { local: selectedLocal } })
  }

  const openRecipes = () => {
    navigate(`/local/${localId}/inventario/recipes`, { state: { local: selectedLocal } })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="hub">
      <Fragment>
      <div className="inv-hub-page">
        <header className="inv-hub-page__intro">
          <h2 className="inv-hub-page__title">Centro de gestión de inventario</h2>
          <p className="inv-hub-page__lead">
            Selecciona un área para trabajar. El control de stock incluye KPIs, listado y alta de productos.
          </p>
        </header>

        <div className="inv-feature-grid">
          <article className="inv-feature-card">
            <div className="inv-feature-card__head">
              <span className="inv-feature-card__head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 5c-2 3-6 4-6 8a6 6 0 1012 0c0-4-4-5-6-8z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div className="inv-feature-card__head-text">
                <h3>Recetas</h3>
                <p>Costos y fichas técnicas</p>
              </div>
              <span className="inv-feature-card__chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="inv-feature-card__body">
              <p className="inv-feature-card__label">Funcionalidades:</p>
              <ul className="inv-feature-card__list">
                <li>CRUD de recetas e ingredientes</li>
                <li>Cálculo automático de costos</li>
                <li>Análisis de rentabilidad</li>
              </ul>
              <button type="button" className="inv-feature-card__btn inv-feature-card__btn--primary" onClick={openRecipes}>
                Gestionar Recetas →
              </button>
            </div>
          </article>

          <article className="inv-feature-card inv-feature-card--emphasis">
            <div className="inv-feature-card__head">
              <span className="inv-feature-card__head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <div className="inv-feature-card__head-text">
                <h3>Stock</h3>
                <p>Control operativo del local</p>
              </div>
              <span className="inv-feature-card__chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="inv-feature-card__body">
              <p className="inv-feature-card__label">Funcionalidades:</p>
              <ul className="inv-feature-card__list">
                <li>Listado y KPIs de inventario</li>
                <li>Entradas, salidas y alertas</li>
                <li>Valorización y productos nuevos</li>
              </ul>
              <button type="button" className="inv-feature-card__btn inv-feature-card__btn--primary" onClick={openStock}>
                Gestionar Stock →
              </button>
            </div>
          </article>

          <article className="inv-feature-card">
            <div className="inv-feature-card__head">
              <span className="inv-feature-card__head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 10h3l2-4h6l2 4h3v8H4V10z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 18v-4h6v4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <div className="inv-feature-card__head-text">
                <h3>Proveedores</h3>
                <p>Red de compras</p>
              </div>
              <span className="inv-feature-card__chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="inv-feature-card__body">
              <p className="inv-feature-card__label">Funcionalidades:</p>
              <ul className="inv-feature-card__list">
                <li>Directorio y contactos</li>
                <li>Historial de compras</li>
                <li>Evaluación de proveedores</li>
              </ul>
              <button type="button" className="inv-feature-card__btn" disabled aria-disabled="true">
                Próximamente →
              </button>
            </div>
          </article>
        </div>

        <section className="inv-alerts" aria-labelledby="inv-alerts-title">
          <div className="inv-alerts__head">
            <h2 id="inv-alerts-title">Alertas recientes</h2>
            <p>Productos que requieren atención en este local</p>
          </div>
          {alertsLoading ? (
            <LoadingSpinner message="Cargando alertas..." />
          ) : alerts.length === 0 ? (
            <p className="inv-alerts__empty">No hay productos en alerta. Todo se ve en orden.</p>
          ) : (
            <ul className="inv-alerts__list">
              {alerts.map((a) => (
                <li key={a.id} className={`inv-alert-row inv-alert-row--${a.level}`}>
                  <span className="inv-alert-row__icon" aria-hidden="true">
                    {a.level === 'critical' ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                        <path d="M12 9v4M12 17h.01M10.3 3.6L2.2 18.4A1 1 0 003.1 20h17.8a1 1 0 00.9-1.6L13.7 3.6a1 1 0 00-1.8 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                        <path d="M12 9v4M12 17h.01M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </span>
                  <div className="inv-alert-row__text">
                    <strong>
                      {a.name} — {a.level === 'critical' ? 'Stock crítico' : 'Stock bajo'}
                    </strong>
                    <span>{a.detail}</span>
                  </div>
                  <button type="button" className="inv-alert-row__action" onClick={openStock}>
                    Ver detalles
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <button type="button" className="inv-help-fab" aria-label="Ayuda" title="Ayuda">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5a2.5 2.5 0 114.2 1.8c-.7.6-1.2 1.4-1.2 2.2V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="17.5" r="0.75" fill="currentColor" />
        </svg>
      </button>
      </Fragment>
    </InventoryShell>
  )
}

export default InventoryHub
