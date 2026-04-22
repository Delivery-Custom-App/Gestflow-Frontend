import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getAuthContext } from '../lib/apiClient'
import { getInventoryKpisByLocal } from '../lib/inventoryApi'
import '../styles/InventoryKpiDashboard.css'

/** HU-49: refresco automático del KPI (0 = solo manual). Por defecto 60s si no hay .env */
const pollMs = Number(import.meta.env.VITE_KPI_POLL_INTERVAL_MS ?? 60000) || 0

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value))
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-BO')
  } catch {
    return String(iso)
  }
}

function IconWallet() {
  return (
    <svg className="inventory-kpi-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6a2 2 0 012-2h11a2 2 0 012 2v3H9a2 2 0 00-2 2v7H6a2 2 0 01-2-2V6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 11h12v9a2 2 0 01-2 2H9V11z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="16" r="1.2" fill="currentColor" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg className="inventory-kpi-card__icon inventory-kpi-card__icon--sm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12l8-4M12 12v10M12 12L4 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function InventoryKpiDashboard({ user, userRole, onLogout }) {
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

  useEffect(() => {
    if (pollMs <= 0) return undefined
    const id = window.setInterval(() => {
      load()
    }, pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  /** Al volver a la pestaña, recalcula métricas ante posibles cambios de inventario/precios */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const handleBack = () => {
    navigate(`/local/${localId}`, { state: { local: selectedLocal } })
  }

  const handleLogoutClick = () => {
    onLogout()
    navigate('/')
  }

  return (
    <main className="inventory-kpi-page">
      <header className="inventory-kpi-header">
        <div className="header-content">
          <div className="kpi-brand-section">
            <img src="/sibaritco-logo.svg" alt="Sibarítco" className="kpi-brand-logo" />
            <div className="kpi-brand-text">
              <h1>Inventario · KPIs</h1>
              <p className="kpi-header-subtitle">
                {selectedLocal?.name || 'Local'}
              </p>
            </div>
          </div>

          <div className="kpi-user-section">
            <div className="kpi-info-stack">
              <span className="kpi-user-email">{user?.email}</span>
              <span className="kpi-user-badge">{userRole || 'Usuario'}</span>
              {data?.generated_at && (
                <span className="kpi-meta-info">Últim. act: {formatDate(data.generated_at)}</span>
              )}
              {pollMs > 0 ? (
                <span className="kpi-meta-info kpi-meta-poll">
                  Refresco: {Math.round(pollMs / 1000)}s
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="kpi-action-btn"
              onClick={load}
              disabled={loading}
              title={loading ? 'Actualizando…' : 'Actualizar datos'}
              aria-label="Actualizar KPIs"
            >
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path
                  d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="kpi-nav-btn"
              onClick={handleBack}
              aria-label="Volver al local"
              title="Volver al panel del local"
            >
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path
                  d="M19 12H5M12 5L5 12L12 19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="kpi-logout-btn"
              onClick={handleLogoutClick}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path
                  d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.1 12.1 19 11 19H5C3.9 19 3 18.1 3 17V7C3 5.9 3.9 5 5 5H11C12.1 5 13 5.9 13 7V8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="inventory-kpi-shell">

        {error ? <div className="inventory-status error">{error}</div> : null}
        {!error && loading && !data ? (
          <div className="inventory-status info">Cargando indicadores…</div>
        ) : null}

        {data ? (
          <>
            <section className="inventory-kpi-hero" aria-label="KPI principal — valor total inventario (HU-49)">
              <article className="inventory-kpi-card inventory-kpi-card--hero">
                <div className="inventory-kpi-card__hero-top">
                  <IconWallet />
                  <span className="inventory-kpi-card__badge">HU-49</span>
                </div>
                <p className="inventory-kpi-card__label">Métrica financiera global — valor total del inventario</p>
                <p className="inventory-kpi-card__value inventory-kpi-card__value--hero">
                  {formatMoney(data.total_value)}
                </p>
                <p className="inventory-kpi-card__hint">
                  Criterio de aceptación: valor total = suma de todos los valores por producto (stock × precio
                  unitario). Se recalcula en cada consulta al servidor.
                </p>
              </article>
            </section>

            <h2 className="inventory-kpi-section-title">Resumen operativo</h2>
            <section className="inventory-kpi-grid" aria-label="Indicadores de inventario">
              <article className="inventory-kpi-card inventory-kpi-card--metric">
                <div className="inventory-kpi-card__metric-head">
                  <IconPackage />
                  <p className="inventory-kpi-card__label">Productos en inventario</p>
                </div>
                <p className="inventory-kpi-card__value">{data.total_products ?? 0}</p>
                <p className="inventory-kpi-card__hint">Filas con producto en este local</p>
              </article>

              <article
                className="inventory-kpi-card inventory-kpi-card--metric inventory-kpi-card--critical"
              >
                <p className="inventory-kpi-card__label">Stock crítico</p>
                <p className="inventory-kpi-card__value">{data.critical_stock_count ?? 0}</p>
                <p className="inventory-kpi-card__hint">Por debajo de umbrales de seguridad</p>
              </article>

              <article className="inventory-kpi-card inventory-kpi-card--metric inventory-kpi-card--low">
                <p className="inventory-kpi-card__label">Stock bajo</p>
                <p className="inventory-kpi-card__value">{data.low_stock_count ?? 0}</p>
                <p className="inventory-kpi-card__hint">Requiere atención pronto</p>
              </article>

              <article className="inventory-kpi-card inventory-kpi-card--metric inventory-kpi-card--medium">
                <p className="inventory-kpi-card__label">Stock medio</p>
                <p className="inventory-kpi-card__value">{data.medium_stock_count ?? 0}</p>
                <p className="inventory-kpi-card__hint">En rango intermedio</p>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}

export default InventoryKpiDashboard
