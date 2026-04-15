import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import {
  getCajasByLocal,
  getConsolidatedDashboard,
  getExpensesByLocal,
  getLocalDashboard,
  getOrdersByLocal,
  getRendicionesDashboard,
  getTransfersByLocal,
} from '../lib/administrativeApi'
import { getAuthContext } from '../lib/apiClient'
import '../styles/AdministrativeModule.css'

const sections = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Resumen general del sistema',
  },
  {
    id: 'ventas',
    label: 'Ventas',
    subtitle: 'Ventas del dia con desglose',
  },
  {
    id: 'rendiciones',
    label: 'Rendiciones',
    subtitle: 'Resumen de transferencias dueno a local',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    subtitle: 'Ventas, flujo y comparativas por periodo',
  },
  {
    id: 'flujo-caja',
    label: 'Flujo de Caja',
    subtitle: 'Resumen monetario por periodo de tiempo',
  },
  {
    id: 'alertas',
    label: 'Alertas',
    subtitle: 'Seccion reservada para otro desarrollador',
  },
  {
    id: 'bonos',
    label: 'Bonos',
    subtitle: 'Resumen de bonos por meta cumplida',
  },
]

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizePaymentMethod(method) {
  const value = String(method || '').toLowerCase()

  if (value.includes('cash') || value.includes('efectivo')) return 'Efectivo'
  if (value.includes('debit') || value.includes('debito')) return 'Debito'
  if (value.includes('credit') || value.includes('credito')) return 'Credito'
  if (value.includes('transfer')) return 'Transferencia'

  return 'Otro'
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }

  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getOrderAmount(order) {
  const directAmount =
    toNumber(order?.total_amount) ||
    toNumber(order?.amount) ||
    toNumber(order?.total) ||
    toNumber(order?.subtotal)

  if (directAmount > 0) return directAmount

  const items = safeArray(order?.items)
  return items.reduce((sum, item) => {
    const quantity = toNumber(item?.quantity, 1)
    const unitPrice = toNumber(item?.unit_price)
    return sum + quantity * unitPrice
  }, 0)
}

function SectionActions({ activeSection }) {
  if (activeSection === 'ventas') {
    return (
      <button type="button" className="am-action am-primary" disabled>
        + Nueva Venta
      </button>
    )
  }

  if (activeSection === 'rendiciones') {
    return (
      <div className="am-actions-group">
        <button type="button" className="am-action" disabled>
          + Nuevo Gasto
        </button>
        <button type="button" className="am-action am-primary" disabled>
          Reportar Transferencia
        </button>
      </div>
    )
  }

  if (activeSection === 'reportes' || activeSection === 'flujo-caja') {
    return (
      <div className="am-actions-group">
        <button type="button" className="am-action" disabled>
          Semana
        </button>
        <button type="button" className="am-action" disabled>
          Mes
        </button>
        <button type="button" className="am-action am-primary" disabled>
          Periodo Personalizado
        </button>
      </div>
    )
  }

  return null
}

function SectionState({ loading, error, isEmpty, emptyMessage }) {
  if (!loading && !error && !isEmpty) return null

  return (
    <section className={`am-state-card ${error ? 'am-error' : ''}`}>
      {loading && <p>Cargando datos del backend...</p>}
      {!loading && error && <p>Error al cargar seccion: {error}</p>}
      {!loading && !error && isEmpty && <p>{emptyMessage}</p>}
    </section>
  )
}

function DashboardContent({ dashboard, loading, error }) {
  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!dashboard && !loading && !error}
      emptyMessage="No hay datos de dashboard para este local"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  const goal = dashboard?.monthly_goal || {}
  const progress = Math.max(0, Math.min(100, toNumber(goal.progress_percentage)))

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Ventas de Hoy</p>
          <strong>{formatMoney(dashboard?.daily_sales)}</strong>
          <span>Actualizado en tiempo real</span>
        </article>
        <article className="am-kpi-card">
          <p>Ventas del Mes</p>
          <strong>{formatMoney(dashboard?.monthly_sales)}</strong>
          <span>Meta {formatMoney(goal.target_amount)}</span>
        </article>
        <article className="am-kpi-card">
          <p>Flujo de Caja</p>
          <strong>{formatMoney(dashboard?.monthly_cash_flow)}</strong>
          <span>Ingresos - Gastos</span>
        </article>
        <article className="am-kpi-card am-warning">
          <p>Alertas Activas</p>
          <strong>{toNumber(dashboard?.active_alerts)}</strong>
          <span>Segun agregado de dashboard</span>
        </article>
      </section>

      <section className="am-panels am-two-columns">
        <article className="am-panel">
          <h3>Meta Mensual</h3>
          <p className="am-muted">Seguimiento del objetivo mensual de ventas</p>
          <div className="am-progress">
            <div className="am-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="am-split-row">
            <span>Alcanzado: {formatMoney(goal.achieved_amount)}</span>
            <span>Restante: {formatMoney(goal.remaining_amount)}</span>
          </div>
        </article>

        <article className="am-panel am-blue">
          <h3>Cajas y Operacion</h3>
          <p className="am-muted">Estado operativo del local</p>
          <div className="am-list-compact">
            <div>
              <span>Cajas activas</span>
              <strong>{toNumber(dashboard?.active_cajas_count || dashboard?.petty_cash?.active_cajas)}</strong>
            </div>
            <div>
              <span>Total cajas</span>
              <strong>{toNumber(dashboard?.cajas_count || dashboard?.petty_cash?.total_cajas)}</strong>
            </div>
            <div>
              <span>Gastos pendientes</span>
              <strong>{formatMoney(dashboard?.pending_expenses_amount)}</strong>
            </div>
          </div>
        </article>
      </section>
    </>
  )
}

function VentasContent({ orders, loading, error }) {
  const list = safeArray(orders)

  const summary = list.reduce(
    (acc, order) => {
      const amount = getOrderAmount(order)
      const method = normalizePaymentMethod(order?.payment_method)

      acc.total += amount
      acc.count += 1

      if (method === 'Efectivo') acc.cash += amount
      else if (method === 'Debito') acc.debit += amount
      else if (method === 'Credito') acc.credit += amount
      else acc.other += amount

      return acc
    },
    {
      total: 0,
      count: 0,
      cash: 0,
      debit: 0,
      credit: 0,
      other: 0,
    },
  )

  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={false}
      emptyMessage=""
    />
  )

  if (stateNode.props.loading || stateNode.props.error) {
    return stateNode
  }

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Total Hoy</p>
          <strong>{formatMoney(summary.total)}</strong>
          <span>{summary.count} ventas registradas</span>
        </article>
        <article className="am-kpi-card">
          <p>Efectivo</p>
          <strong>{formatMoney(summary.cash)}</strong>
        </article>
        <article className="am-kpi-card am-blue">
          <p>Debito</p>
          <strong>{formatMoney(summary.debit)}</strong>
        </article>
        <article className="am-kpi-card am-purple">
          <p>Credito</p>
          <strong>{formatMoney(summary.credit)}</strong>
        </article>
      </section>

      <section className="am-panel">
        <h3>Ventas del Dia</h3>
        <p className="am-muted">Listado obtenido desde /orders por local</p>

        {list.length === 0 ? (
          <p className="am-empty-note">No hay ventas registradas para este local.</p>
        ) : (
          <div className="am-list-block">
            {list.slice(0, 12).map((order) => (
              <article key={order.id} className="am-row-card">
                <div>
                  <strong>{formatMoney(getOrderAmount(order))}</strong>
                  <p>
                    Orden #{String(order.id || '').slice(0, 8)} - {normalizePaymentMethod(order.payment_method)} - {formatDateTime(order.created_at)}
                  </p>
                  <span>
                    Estado: {order.status || 'sin estado'} - Fuente: {order.source || 'sin fuente'}
                  </span>
                </div>
                <span className="am-pill">{normalizePaymentMethod(order.payment_method)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function RendicionesContent({ rendiciones, expenses, transfers, loading, error }) {
  const movements = safeArray(rendiciones?.movements)
  const expensesList = safeArray(expenses)
  const transfersList = safeArray(transfers)

  const fallbackRows = [
    ...expensesList.map((item) => ({
      id: item.id,
      movement_type: 'expense',
      amount: toNumber(item.amount),
      status: item.status || 'pending',
      occurred_at: item.expense_date || item.created_at,
      description: item.description,
    })),
    ...transfersList.map((item) => ({
      id: item.id,
      movement_type: 'transfer',
      amount: toNumber(item.amount),
      status: item.status || 'pending',
      occurred_at: item.created_at,
      description: item.receipt_url,
    })),
  ]

  const rows = (movements.length > 0 ? movements : fallbackRows)
    .sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0))
    .slice(0, 12)

  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!rendiciones && rows.length === 0 && !loading && !error}
      emptyMessage="No hay datos de rendiciones para este local"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Transferencias Completadas</p>
          <strong>{formatMoney(rendiciones?.completed_transfers_total)}</strong>
          <span>Periodo consultado</span>
        </article>
        <article className="am-kpi-card am-red">
          <p>Gastos Aprobados</p>
          <strong>{formatMoney(rendiciones?.approved_expenses_total)}</strong>
          <span>Periodo consultado</span>
        </article>
        <article className="am-kpi-card am-blue">
          <p>Flujo Neto</p>
          <strong>{formatMoney(rendiciones?.net_flow)}</strong>
          <span>Transferencias - Gastos</span>
        </article>
        <article className="am-kpi-card am-warning">
          <p>Pendientes</p>
          <strong>{formatMoney(toNumber(rendiciones?.pending_expenses_total) + toNumber(rendiciones?.pending_transfers_total))}</strong>
          <span>Montos pendientes</span>
        </article>
      </section>

      <section className="am-panel">
        <h3>Movimientos de Rendiciones</h3>
        <p className="am-muted">Resultado de /dashboard/rendiciones + respaldo de /expenses y /transfers</p>

        {rows.length === 0 ? (
          <p className="am-empty-note">No existen movimientos en el rango actual.</p>
        ) : (
          <div className="am-list-block">
            {rows.map((row) => (
              <article key={`${row.movement_type}-${row.id}`} className="am-row-card">
                <div>
                  <strong>{formatMoney(row.amount)}</strong>
                  <p>
                    {row.movement_type === 'transfer' ? 'Transferencia' : 'Gasto'} - {formatDateTime(row.occurred_at)}
                  </p>
                  <span>{row.description || 'Sin descripcion'}</span>
                </div>
                <span className="am-pill">{row.status || 'sin estado'}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function ReportesContent({ consolidated, loading, error }) {
  const topProducts = safeArray(consolidated?.top_products)

  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!consolidated && !loading && !error}
      emptyMessage="No hay metricas consolidadas disponibles"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Ventas Diarias (Consolidado)</p>
          <strong>{formatMoney(consolidated?.daily_sales)}</strong>
          <span>{toNumber(consolidated?.local_count)} locales</span>
        </article>
        <article className="am-kpi-card">
          <p>Ventas Mensuales</p>
          <strong>{formatMoney(consolidated?.monthly_sales)}</strong>
          <span>Consolidado negocio</span>
        </article>
        <article className="am-kpi-card am-blue">
          <p>Flujo de Caja Mensual</p>
          <strong>{formatMoney(consolidated?.monthly_cash_flow)}</strong>
          <span>Consolidado negocio</span>
        </article>
        <article className="am-kpi-card am-warning">
          <p>Alertas Activas</p>
          <strong>{toNumber(consolidated?.active_alerts)}</strong>
          <span>Agregado global</span>
        </article>
      </section>

      <section className="am-panels am-two-columns">
        <article className="am-panel">
          <h3>Reporte de Ventas</h3>
          <p className="am-muted">Vista para graficos por semana, mes, trimestre y ano</p>
          <div className="am-chart-placeholder">Conectar aqui componente de grafico de ventas por periodo</div>
        </article>

        <article className="am-panel am-blue">
          <h3>Reporte de Flujo</h3>
          <p className="am-muted">Comparativa de flujo de caja por periodos</p>
          <div className="am-chart-placeholder">Conectar aqui componente de grafico de flujo de caja</div>
        </article>
      </section>

      <section className="am-panel">
        <h3>Top Productos (Consolidado)</h3>
        <p className="am-muted">Fuente: campo top_products del endpoint consolidado</p>

        <table className="am-table" aria-label="Top productos del consolidado">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Unidades</th>
              <th>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.length === 0 && (
              <tr>
                <td colSpan="3">No hay productos para mostrar.</td>
              </tr>
            )}
            {topProducts.slice(0, 8).map((product) => (
              <tr key={product.product_id || product.product_name}>
                <td>{product.product_name || 'Producto sin nombre'}</td>
                <td>{toNumber(product.units_sold)}</td>
                <td>{formatMoney(product.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function FlujoCajaContent({ dashboard, cajas, loading, error }) {
  const cajasList = safeArray(cajas)

  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!dashboard && !loading && !error}
      emptyMessage="No hay datos de flujo de caja para este local"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Total Ingresos</p>
          <strong>{formatMoney(dashboard?.monthly_sales)}</strong>
          <span>Mes actual</span>
        </article>
        <article className="am-kpi-card am-red">
          <p>Total Gastos</p>
          <strong>{formatMoney(dashboard?.monthly_expenses)}</strong>
          <span>Mes actual</span>
        </article>
        <article className="am-kpi-card am-blue">
          <p>Flujo Neto</p>
          <strong>{formatMoney(dashboard?.monthly_cash_flow)}</strong>
          <span>Resultado mensual</span>
        </article>
      </section>

      <section className="am-panels am-two-columns">
        <article className="am-panel">
          <h3>Tendencia de Ingresos</h3>
          <p className="am-muted">Analisis visual pendiente segun referencia final</p>
          <div className="am-chart-placeholder">Placeholder de grafico de ingresos por periodo</div>
        </article>

        <article className="am-panel am-red">
          <h3>Desglose de Gastos</h3>
          <p className="am-muted">Analisis visual pendiente segun referencia final</p>
          <div className="am-chart-placeholder">Placeholder de distribucion de gastos</div>
        </article>
      </section>

      <section className="am-panel">
        <h3>Cajas del Local</h3>
        <p className="am-muted">Fuente: endpoint /cajas por local</p>

        <table className="am-table" aria-label="Cajas del local">
          <thead>
            <tr>
              <th>Nombre Caja</th>
              <th>Estado</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {cajasList.length === 0 && (
              <tr>
                <td colSpan="3">No hay cajas registradas para este local.</td>
              </tr>
            )}
            {cajasList.map((caja) => (
              <tr key={caja.id}>
                <td>{caja.name || 'Caja sin nombre'}</td>
                <td>{caja.is_active ? 'Activa' : 'Inactiva'}</td>
                <td>{String(caja.id || '').slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function AlertasContent({ dashboard, loading, error }) {
  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!dashboard && !loading && !error}
      emptyMessage="No hay datos de alertas para este local"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  return (
    <section className="am-panel am-warning-panel">
      <h3>Alertas del Sistema</h3>
      <p className="am-muted">
        Esta seccion funcional corresponde a otro desarrollador. Aqui solo mostramos el agregado disponible en dashboard.
      </p>
      <div className="am-list-compact">
        <div>
          <span>Alertas activas</span>
          <strong>{toNumber(dashboard?.active_alerts)}</strong>
        </div>
      </div>
    </section>
  )
}

function BonosContent({ dashboard, loading, error }) {
  const stateNode = (
    <SectionState
      loading={loading}
      error={error}
      isEmpty={!dashboard && !loading && !error}
      emptyMessage="No hay datos de bonos para este local"
    />
  )

  if (stateNode.props.loading || stateNode.props.error || stateNode.props.isEmpty) {
    return stateNode
  }

  const goal = dashboard?.monthly_goal || {}
  const progress = Math.max(0, Math.min(100, toNumber(goal.progress_percentage)))

  return (
    <>
      <section className="am-kpi-grid">
        <article className="am-kpi-card">
          <p>Meta Mensual</p>
          <strong>{formatMoney(goal.target_amount)}</strong>
          <span>Objetivo configurado</span>
        </article>
        <article className="am-kpi-card am-blue">
          <p>Monto Alcanzado</p>
          <strong>{formatMoney(goal.achieved_amount)}</strong>
          <span>Ventas acumuladas</span>
        </article>
        <article className="am-kpi-card am-purple">
          <p>Progreso</p>
          <strong>{progress.toFixed(1)}%</strong>
          <span>Porcentaje de cumplimiento</span>
        </article>
      </section>

      <section className="am-panel">
        <h3>Resumen de Bonos por Meta</h3>
        <p className="am-muted">Actualmente basado en monthly_goal del dashboard</p>
        <div className="am-progress">
          <div className="am-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="am-split-row">
          <span>Restante para meta: {formatMoney(goal.remaining_amount)}</span>
          <span>Alertas activas: {toNumber(dashboard?.active_alerts)}</span>
        </div>
      </section>
    </>
  )
}

function renderSectionContent(activeSection, payload) {
  switch (activeSection) {
    case 'dashboard':
      return <DashboardContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} />
    case 'ventas':
      return <VentasContent orders={payload.orders} loading={payload.loading} error={payload.error} />
    case 'rendiciones':
      return (
        <RendicionesContent
          rendiciones={payload.rendiciones}
          expenses={payload.expenses}
          transfers={payload.transfers}
          loading={payload.loading}
          error={payload.error}
        />
      )
    case 'reportes':
      return <ReportesContent consolidated={payload.consolidated} loading={payload.loading} error={payload.error} />
    case 'flujo-caja':
      return <FlujoCajaContent dashboard={payload.dashboard} cajas={payload.cajas} loading={payload.loading} error={payload.error} />
    case 'alertas':
      return <AlertasContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} />
    case 'bonos':
      return <BonosContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} />
    default:
      return <DashboardContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} />
  }
}

function AdministrativeModule({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId, sectionId } = useParams()
  const { locales } = useLocals()

  const [sectionData, setSectionData] = useState({
    dashboard: null,
    orders: [],
    rendiciones: null,
    expenses: [],
    transfers: [],
    consolidated: null,
    cajas: [],
  })
  const [loading, setLoading] = useState(false)
  const [sectionError, setSectionError] = useState('')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const selectedLocal = useMemo(() => {
    if (location.state?.local) {
      return location.state.local
    }

    return locales.find((local) => String(local.id) === String(localId)) || null
  }, [location.state, locales, localId])

  const activeSection = sections.some((section) => section.id === sectionId) ? sectionId : 'dashboard'
  const activeSectionMeta = sections.find((section) => section.id === activeSection) || sections[0]

  useEffect(() => {
    let ignore = false

    async function fetchSectionData() {
      if (!localId) return

      setLoading(true)
      setSectionError('')

      try {
        const { token, businessId } = await getAuthContext()
        const updates = {}

        if (['dashboard', 'flujo-caja', 'alertas', 'bonos'].includes(activeSection)) {
          updates.dashboard = await getLocalDashboard(localId, token)
        }

        if (activeSection === 'ventas') {
          updates.orders = await getOrdersByLocal(localId, token)
        }

        if (activeSection === 'rendiciones') {
          const [rendiciones, expenses, transfers] = await Promise.all([
            getRendicionesDashboard(localId, token),
            getExpensesByLocal(localId, token),
            getTransfersByLocal(localId, token),
          ])

          updates.rendiciones = rendiciones
          updates.expenses = safeArray(expenses)
          updates.transfers = safeArray(transfers)
        }

        if (activeSection === 'reportes') {
          if (!businessId) {
            throw new Error('No se encontro business_id en el token para obtener reportes consolidados')
          }

          updates.consolidated = await getConsolidatedDashboard(businessId, token)
        }

        if (activeSection === 'flujo-caja') {
          updates.cajas = await getCajasByLocal(localId, token)
        }

        if (!ignore) {
          setSectionData((previous) => ({ ...previous, ...updates }))
        }
      } catch (error) {
        if (!ignore) {
          setSectionError(error.message || 'No se pudo cargar la informacion del modulo')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetchSectionData()

    return () => {
      ignore = true
    }
  }, [localId, activeSection])

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [activeSection, localId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isMobile = window.matchMedia('(max-width: 1040px)').matches
    if (!isMobile) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = isMobileNavOpen ? 'hidden' : previousOverflow

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavOpen])

  const handleGoModules = () => {
    setIsMobileNavOpen(false)
    navigate('/admin', { state: { local: selectedLocal, focusLocalId: localId } })
  }

  const handleBackToLocals = () => {
    setIsMobileNavOpen(false)
    navigate('/admin')
  }

  const handleSelectSection = (section) => {
    setIsMobileNavOpen(false)
    navigate(`/local/${localId}/administrativo/${section.id}`, { state: { local: selectedLocal } })
  }

  const handleLogoutClick = () => {
    setIsMobileNavOpen(false)
    onLogout()
    navigate('/')
  }

  return (
    <div className="administrative-module-layout">
      <aside className={`am-sidebar ${isMobileNavOpen ? 'open' : ''}`} aria-label="Navegacion del modulo administrativo">
        <div className="am-sidebar-brand">
          <div className="am-sidebar-brand-row">
            <div>
              <h2>Administrativo</h2>
              <p>Modulo Activo</p>
            </div>
            <button
              type="button"
              className="am-sidebar-close"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Cerrar menu"
            >
              Cerrar
            </button>
          </div>
        </div>

        <button type="button" className="am-back-modules" onClick={handleGoModules}>
          Volver a Modulos
        </button>

        <section className="am-user-card" aria-label="Usuario activo">
          <h3>{user?.email || 'Administrador Demo'}</h3>
          <p>{userRole || 'Usuario'}</p>
        </section>

        <nav id="am-sidebar-nav" className="am-sidebar-nav" aria-label="Secciones">
          <p>NAVEGACION</p>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`am-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => handleSelectSection(section)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <footer className="am-sidebar-footer">desde 1991</footer>
      </aside>

      {isMobileNavOpen && (
        <button
          type="button"
          className="am-sidebar-backdrop"
          aria-label="Cerrar menu"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <div className="am-main-wrapper">
        <header className="am-topbar">
          <div className="am-topbar-left">
            <button
              type="button"
              className="am-nav-toggle"
              onClick={() => setIsMobileNavOpen((value) => !value)}
              aria-controls="am-sidebar-nav"
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? 'Cerrar menu' : 'Menu'}
            </button>
            <h1>SibaGestion - Sistema Comercial Integral</h1>
            <button type="button" className="am-action" onClick={handleGoModules}>
              Modulos
            </button>
          </div>

          <div className="am-topbar-right">
            <span className="am-chip">Demo</span>
            <div className="am-user-inline">
              <strong>{userRole || 'Administrador Demo'}</strong>
              <span>{selectedLocal?.name || 'Sin local asignado'}</span>
            </div>
            <button type="button" className="am-action" onClick={handleLogoutClick}>
              Salir
            </button>
          </div>
        </header>

        <main className="am-main-content">
          <section className="am-section-head">
            <div>
              <h2>{activeSectionMeta.label}</h2>
              <p>{activeSectionMeta.subtitle}</p>
              <small className="am-local-badge">Local: {selectedLocal?.name || localId || 'No identificado'}</small>
            </div>

            <SectionActions activeSection={activeSection} />
          </section>

          {renderSectionContent(activeSection, {
            ...sectionData,
            loading,
            error: sectionError,
          })}

          <div className="am-mobile-actions">
            <button type="button" className="am-action" onClick={handleBackToLocals}>
              Volver a Locales
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdministrativeModule
