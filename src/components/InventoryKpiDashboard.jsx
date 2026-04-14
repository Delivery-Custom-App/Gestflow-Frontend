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
      <div className="inventory-kpi-shell">
        <header className="inventory-kpi-header">
          <div>
            <h1>Inventario · KPIs</h1>
            <p className="inventory-kpi-header__subtitle">
              {selectedLocal?.name ? `${selectedLocal.name} · ` : ''}
              {userRole ? `${userRole}` : 'Usuario'}
              {user?.email ? ` · ${user.email}` : ''}
            </p>
            {data?.generated_at && (
              <p className="inventory-kpi-meta">Actualizado: {formatDate(data.generated_at)}</p>
            )}
            {pollMs > 0 ? (
              <p className="inventory-kpi-meta inventory-kpi-meta--poll">
                Actualización automática cada {Math.round(pollMs / 1000)} s (HU-49)
              </p>
            ) : null}
          </div>
          <div className="inventory-kpi-actions">
            <button type="button" className="inventory-btn" onClick={handleBack}>
              Volver al local
            </button>
            <button type="button" className="inventory-btn primary" onClick={load} disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
            <button type="button" className="inventory-btn" onClick={handleLogoutClick}>
              Salir
            </button>
          </div>
        </header>

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
