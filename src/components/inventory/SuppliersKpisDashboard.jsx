import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getAuthContext } from '../../lib/apiClient'
import { getSupplierKpisByLocal } from '../../lib/inventoryApi'
import { isInventoryAdminRole } from '../../utils/inventoryAccess'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import '../../styles/inventory/StockControlDashboard.css'

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatMoneyClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
  return `$${n}`
}

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function SuppliersKpisDashboard({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  const location = useLocation()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const canAccess = isInventoryAdminRole(userRole)

  const [{ year, month }, setPeriod] = useState(() => currentYearMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canAccess) {
      setLoading(false)
      setData(null)
      setError('')
      return
    }
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token } = await getAuthContext()
      const payload = await getSupplierKpisByLocal(localId, token, { year, month })
      setData(payload)
    } catch (e) {
      setData(null)
      setError(e?.message || 'No se pudieron cargar los KPIs de proveedores.')
    } finally {
      setLoading(false)
    }
  }, [localId, year, month, canAccess])

  useEffect(() => {
    load()
  }, [load])

  const periodLabel = `${MONTH_NAMES[(month || 1) - 1] ?? ''} ${year}`

  const yearOptions = useMemo(() => {
    const y0 = new Date().getFullYear()
    return [y0 - 1, y0, y0 + 1]
  }, [])

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

        <div className="scd-suppliers-head">
          <header className="scd-header scd-header--compact">
            <span className="scd-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 10h3l2-4h6l2 4h3v8H4V10z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 18v-4h6v4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <div>
              <h1 className="scd-title">Proveedores · KPIs</h1>
              <p className="scd-subtitle">Directorio y compras de insumos aprobadas por mes calendario</p>
            </div>
          </header>

          {canAccess ? (
            <div className="scd-period-toolbar" role="group" aria-label="Período">
              <span className="scd-period-label">Mes</span>
              <select
                className="scd-period-select"
                aria-label="Año"
                value={year}
                onChange={(ev) => setPeriod({ year: Number(ev.target.value), month })}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="scd-period-select"
                aria-label="Mes"
                value={month}
                onChange={(ev) => setPeriod({ year, month: Number(ev.target.value) })}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="scd-period-refresh"
                onClick={() => load()}
                disabled={loading}
                aria-label="Actualizar KPIs de proveedores"
              >
                {loading ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          ) : null}
        </div>

        {!canAccess ? (
          <div className="scd-status scd-status--error" role="alert">
            Solo administradores (Admin o Superadmin) pueden ver los KPIs de proveedores.
          </div>
        ) : null}

        {canAccess && error ? <div className="scd-status scd-status--error">{error}</div> : null}
        {canAccess && loading && !data ? <LoadingSpinner message="Cargando indicadores de proveedores…" /> : null}

        {canAccess && data ? (
          <>
            <p className="scd-period-meta">
              Período: <strong>{periodLabel}</strong>
              {data.period_start && data.period_end ? (
                <>
                  {' '}
                  ({data.period_start} — {data.period_end})
                </>
              ) : null}
            </p>
            <section className="scd-kpis" aria-label="KPIs de proveedores">
              <article className="scd-kpi">
                <span className="scd-kpi-icon scd-kpi-icon--box" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="scd-kpi-label">Total proveedores</p>
                  <p className="scd-kpi-value">{data.total_suppliers ?? 0}</p>
                </div>
              </article>
              <article className="scd-kpi scd-kpi--optimal">
                <span className="scd-kpi-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <p className="scd-kpi-label">Proveedores activos</p>
                  <p className="scd-kpi-value">{data.active_suppliers ?? 0}</p>
                </div>
              </article>
              <article className="scd-kpi scd-kpi--value">
                <span className="scd-kpi-icon scd-kpi-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="scd-kpi-label">Compras del mes (CLP)</p>
                  <p className="scd-kpi-value scd-kpi-value--money">{formatMoneyClp(data.month_purchases_clp)}</p>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </InventoryShell>
  )
}

export default SuppliersKpisDashboard
