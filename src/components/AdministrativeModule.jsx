import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../hooks/useSelectedLocal'
import { useAlerts } from '../hooks/useAlerts'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import ExpenseBreakdown from './charts/ExpenseBreakdown'
import {
  getCajasByLocal,
  getConsolidatedDashboard,
  getExpensesByLocal,
  getLocalDashboard,
  getOrdersByLocal,
  getRendicionesDashboard,
  getTransfersByLocal,
  postExpense,
  postTransfer,
} from '../lib/administrativeApi'
import { getAuthContext } from '../lib/apiClient'
import { enrichDashboardWithChartData, generateIncomeTrendFromOrders, generateExpenseBreakdownFromData } from '../utils/chartDataHelpers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'

const sections = [
  { id: 'dashboard',   label: 'Dashboard',      subtitle: 'Resumen general del sistema' },
  { id: 'ventas',      label: 'Ventas',          subtitle: 'Ventas del dia con desglose' },
  { id: 'rendiciones', label: 'Rendiciones',     subtitle: 'Resumen de transferencias dueno a local' },
  { id: 'reportes',    label: 'Reportes',        subtitle: 'Ventas, flujo y comparativas por periodo' },
  { id: 'flujo-caja',  label: 'Flujo de Caja',  subtitle: 'Resumen monetario por periodo de tiempo' },
  { id: 'alertas',     label: 'Alertas',         subtitle: 'Sistema de alertas administrativas del local' },
  { id: 'bonos',       label: 'Bonos',           subtitle: 'Resumen de bonos por meta cumplida' },
]

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function _normalizeOrderStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function normalizePaymentMethod(method) {
  const value = String(method || '').toLowerCase()
  if (value.includes('cash') || value.includes('efectivo')) return 'Efectivo'
  if (value.includes('debit') || value.includes('debito')) return 'Debito'
  if (value.includes('credit') || value.includes('credito')) return 'Credito'
  if (value.includes('transfer')) return 'Transferencia'
  return 'Otro'
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getOrderAmount(order) {
  const directAmount =
    toNumber(order?.total_amount) ||
    toNumber(order?.amount) ||
    toNumber(order?.total) ||
    toNumber(order?.subtotal)
  if (directAmount > 0) return directAmount
  return safeArray(order?.items).reduce((sum, item) => sum + toNumber(item?.quantity, 1) * toNumber(item?.unit_price), 0)
}

// ── Shared UI atoms ────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  const accentCls = {
    warning: 'border-l-amber-400 bg-amber-50',
    red:     'border-l-red-400 bg-red-50',
    blue:    'border-l-blue-400 bg-blue-50',
    purple:  'border-l-violet-400 bg-violet-50',
  }[accent] || 'border-l-[hsl(var(--primary))] bg-[hsl(var(--accent))]'

  return (
    <article className={cn('rounded-xl border-l-4 p-4 shadow-sm', accentCls)}>
      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{label}</p>
      <strong className="mt-1 block text-2xl font-extrabold text-[hsl(var(--foreground))]">{value}</strong>
      {sub && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{sub}</span>}
    </article>
  )
}

function Panel({ title, sub, accent, children }) {
  const accentCls = {
    blue:    'border-blue-200 bg-blue-50',
    red:     'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
  }[accent] || 'border-[hsl(var(--border))] bg-white'

  return (
    <article className={cn('rounded-xl border p-5 shadow-sm', accentCls)}>
      {title && <h3 className="mb-0.5 text-sm font-bold text-[hsl(var(--foreground))]">{title}</h3>}
      {sub && <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
      {children}
    </article>
  )
}

function RowCard({ title, sub, meta, pill }) {
  return (
    <article className="flex items-start justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-white p-3">
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-bold text-[hsl(var(--foreground))]">{title}</strong>
        {sub && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
        {meta && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{meta}</span>}
      </div>
      {pill && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">{pill}</Badge>
      )}
    </article>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
      <div
        className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function AmTable({ headers, rows, emptyMessage }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full text-sm">
        <thead className="bg-[hsl(var(--muted))]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/50]">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-sm text-[hsl(var(--foreground))]">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Section helpers ────────────────────────────────────────────

function SectionActions({ activeSection, onNuevoGasto, onNuevaTransferencia }) {
  if (activeSection === 'ventas') {
    return null
  }
  if (activeSection === 'rendiciones') {
    return (
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNuevoGasto}>+ Nuevo Gasto</Button>
        <Button onClick={onNuevaTransferencia}>Reportar Transferencia</Button>
      </div>
    )
  }
  return null
}

function SectionState({ loading, error, isEmpty, emptyMessage }) {
  if (!loading && !error && !isEmpty) return null
  return (
    <div className={cn('rounded-xl border p-6', error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[hsl(var(--border))] bg-white')}>
      {loading && <LoadingSpinner message="Cargando..." />}
      {!loading && error && <p className="text-sm">Error al cargar sección: {error}</p>}
      {!loading && !error && isEmpty && <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>}
    </div>
  )
}

// ── Section content components ─────────────────────────────────

function DashboardContent({ dashboard, loading, error }) {
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!dashboard && !loading && !error} emptyMessage="No hay datos aún. Crea órdenes desde el POS para ver métricas." />
  if (loading || error || (!dashboard && !loading && !error)) return stateNode

  const goal       = dashboard?.monthly_goal || {}
  const progress   = Math.max(0, Math.min(100, toNumber(goal.progress_percentage)))
  const wc         = dashboard?.week_comparison || null
  const payments   = Array.isArray(dashboard?.payment_breakdown) ? dashboard.payment_breakdown : []
  const peakHour   = dashboard?.peak_hour != null ? `${dashboard.peak_hour}:00 – ${dashboard.peak_hour + 1}:00` : '—'
  const cancelRate = toNumber(dashboard?.cancellation_rate).toFixed(1)
  const weekChange = wc ? toNumber(wc.change_pct) : null
  const weekSign   = weekChange !== null ? (weekChange >= 0 ? '+' : '') : ''

  const PAYMENT_LABEL = { cash: 'Efectivo', efectivo: 'Efectivo', debit: 'Débito', debito: 'Débito', credit: 'Crédito', credito: 'Crédito', transfer: 'Transferencia', other: 'Otro' }
  const payLabel = (m) => PAYMENT_LABEL[String(m).toLowerCase()] || String(m)

  return (
    <div className="space-y-5">

      {/* Fila 1 — ventas principales */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ventas de Hoy"   value={formatMoney(dashboard?.daily_sales)}      sub="Últimas 24 h" />
        <KpiCard label="Ventas del Mes"  value={formatMoney(dashboard?.monthly_sales)}    sub={`Meta ${formatMoney(goal.target_amount)}`} />
        <KpiCard label="Flujo de Caja"   value={formatMoney(dashboard?.monthly_cash_flow)} sub="Ingresos − Gastos" />
        <KpiCard label="Alertas Activas" value={toNumber(dashboard?.active_alerts)}       sub="Requieren atención" accent="warning" />
      </div>

      {/* Fila 2 — métricas operativas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ticket Promedio"   value={formatMoney(dashboard?.avg_ticket)}        sub="Por orden este mes" accent="blue" />
        <KpiCard label="Cancelaciones"     value={`${cancelRate}%`}                          sub="Órdenes canceladas mes" accent="red" />
        <KpiCard label="Stock Crítico"     value={toNumber(dashboard?.stock_critical_count)} sub={`${toNumber(dashboard?.stock_out_count)} sin stock`} accent="warning" />
        <KpiCard label="Mesa Más Activa"   value={dashboard?.top_mesa_name || '—'}           sub="Mayor nº órdenes mes" accent="purple" />
      </div>

      {/* Fila 3 — meta + cajas */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Meta Mensual" sub="Seguimiento del objetivo mensual de ventas">
          <ProgressBar value={progress} />
          <div className="mt-3 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>Alcanzado: {formatMoney(goal.achieved_amount)}</span>
            <span>Restante: {formatMoney(goal.remaining_amount)}</span>
          </div>
        </Panel>
        <Panel title="Cajas y Operación" sub="Estado operativo del local" accent="blue">
          <div className="space-y-2">
            {[
              ['Cajas activas',     toNumber(dashboard?.active_cajas_count || dashboard?.petty_cash?.active_cajas)],
              ['Total cajas',       toNumber(dashboard?.cajas_count || dashboard?.petty_cash?.total_cajas)],
              ['Gastos pendientes', formatMoney(dashboard?.petty_cash?.pending_expenses_amount)],
              ['Hora pico',         peakHour],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                <strong>{val}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Fila 4 — comparativo semanal + pagos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Comparativo Semanal" sub="Esta semana vs semana anterior">
          {wc ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana</p>
                  <p className="text-xl font-extrabold text-[hsl(var(--foreground))]">{formatMoney(wc.current_week_sales)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Semana anterior</p>
                  <p className="text-lg font-bold text-[hsl(var(--muted-foreground))]">{formatMoney(wc.prev_week_sales)}</p>
                </div>
              </div>
              <div className={cn('rounded-lg px-3 py-2 text-sm font-semibold text-center',
                weekChange >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                {weekSign}{toNumber(wc.change_pct).toFixed(1)}% vs semana anterior
              </div>
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin datos suficientes.</p>
          )}
        </Panel>

        <Panel title="Distribución por Pago" sub="Métodos de pago este mes">
          {payments.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin ventas registradas.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => {
                const total = payments.reduce((s, x) => s + toNumber(x.total), 0)
                const pct = total > 0 ? (toNumber(p.total) / total * 100) : 0
                return (
                  <div key={p.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{payLabel(p.method)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{formatMoney(p.total)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
                      <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Fila 5 — inventario */}
      <Panel title="Estado de Inventario" sub="Stock del local este mes">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Crítico (≤25%)',  value: toNumber(dashboard?.stock_critical_count), color: 'text-red-600' },
            { label: 'Bajo (≤50%)',     value: toNumber(dashboard?.stock_low_count),      color: 'text-amber-600' },
            { label: 'Sin stock',       value: toNumber(dashboard?.stock_out_count),      color: 'text-red-700 font-extrabold' },
            { label: 'Valor Inventario',value: formatMoney(dashboard?.inventory_total_value), color: 'text-[hsl(var(--foreground))]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={cn('text-2xl font-extrabold', color)}>{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  )
}

function VentasContent({ orders, loading, error }) {
  const all = safeArray(orders)

  // Últimas 24 horas (ventana rodante)
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const last24h = all.filter((o) => {
    if (!o.created_at) return false
    if (_normalizeOrderStatus(o.status) === 'cancelled') return false
    return new Date(o.created_at) >= cutoff24h
  })

  const summary = last24h.reduce(
    (acc, order) => {
      const amount = getOrderAmount(order)
      const method = normalizePaymentMethod(order?.payment_method)
      acc.total += amount; acc.count += 1
      if (method === 'Efectivo') acc.cash += amount
      else if (method === 'Debito') acc.debit += amount
      else if (method === 'Credito') acc.credit += amount
      else acc.other += amount
      return acc
    },
    { total: 0, count: 0, cash: 0, debit: 0, credit: 0, other: 0 }
  )

  const stateNode = <SectionState loading={loading} error={error} isEmpty={false} emptyMessage="" />
  if (loading || error) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Hoy"  value={formatMoney(summary.total)}  sub={`${summary.count} venta${summary.count !== 1 ? 's' : ''}`} />
        <KpiCard label="Efectivo"   value={formatMoney(summary.cash)} />
        <KpiCard label="Débito"     value={formatMoney(summary.debit)}   accent="blue" />
        <KpiCard label="Crédito"    value={formatMoney(summary.credit)}  accent="purple" />
      </div>
      <Panel title="Ventas del Día" sub="Órdenes no canceladas de las últimas 24 h">
        {last24h.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No hay ventas en las últimas 24 horas.
          </p>
        ) : (
          <div className="space-y-2">
            {last24h.slice(0, 20).map((order) => (
              <RowCard
                key={order.id}
                title={formatMoney(getOrderAmount(order))}
                sub={`#${String(order.id || '').slice(0, 8)} — ${normalizePaymentMethod(order.payment_method)} — ${formatDateTime(order.created_at)}`}
                meta={`Estado: ${order.status || '—'} · Fuente: ${order.source || '—'}`}
                pill={normalizePaymentMethod(order.payment_method)}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function RendicionesContent({ rendiciones, expenses, transfers, loading, error }) {
  const movements = safeArray(rendiciones?.movements)
  const expensesList = safeArray(expenses)
  const transfersList = safeArray(transfers)
  const fallbackRows = [
    ...expensesList.map((item) => ({ id: item.id, movement_type: 'expense',  amount: toNumber(item.amount), status: item.status || 'pending', occurred_at: item.expense_date || item.created_at, description: item.description })),
    ...transfersList.map((item) => ({ id: item.id, movement_type: 'transfer', amount: toNumber(item.amount), status: item.status || 'pending', occurred_at: item.created_at,                     description: item.receipt_url })),
  ]
  const rows = (movements.length > 0 ? movements : fallbackRows)
    .sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0))
    .slice(0, 12)

  const isEmpty = !rendiciones && rows.length === 0 && !loading && !error
  const stateNode = <SectionState loading={loading} error={error} isEmpty={isEmpty} emptyMessage="Sin movimientos aún. Usa los botones 'Nuevo Gasto' y 'Reportar Transferencia' para registrar." />
  if (loading || error || isEmpty) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Transferencias Completadas" value={formatMoney(rendiciones?.completed_transfers_total)} sub="Periodo consultado" />
        <KpiCard label="Gastos Aprobados"           value={formatMoney(rendiciones?.approved_expenses_total)}  sub="Periodo consultado" accent="red" />
        <KpiCard label="Flujo Neto"                 value={formatMoney(rendiciones?.net_flow)}                 sub="Transferencias - Gastos" accent="blue" />
        <KpiCard label="Pendientes"                 value={formatMoney(toNumber(rendiciones?.pending_expenses_total) + toNumber(rendiciones?.pending_transfers_total))} sub="Montos pendientes" accent="warning" />
      </div>
      <Panel title="Movimientos de Rendiciones" sub="Resultado de /dashboard/rendiciones + respaldo de /expenses y /transfers">
        {rows.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No existen movimientos en el rango actual.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <RowCard
                key={`${row.movement_type}-${row.id}`}
                title={formatMoney(row.amount)}
                sub={`${row.movement_type === 'transfer' ? 'Transferencia' : 'Gasto'} — ${formatDateTime(row.occurred_at)}`}
                meta={row.description || 'Sin descripción'}
                pill={row.status || 'sin estado'}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function ReportesContent({ consolidated, loading, error }) {
  const topProducts = safeArray(consolidated?.top_products)
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!consolidated && !loading && !error} emptyMessage="No hay métricas consolidadas disponibles" />
  if (loading || error || (!consolidated && !loading && !error)) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ventas Diarias (Consolidado)" value={formatMoney(consolidated?.daily_sales)}      sub={`${toNumber(consolidated?.local_count)} locales`} />
        <KpiCard label="Ventas Mensuales"             value={formatMoney(consolidated?.monthly_sales)}     sub="Consolidado negocio" />
        <KpiCard label="Flujo de Caja Mensual"        value={formatMoney(consolidated?.monthly_cash_flow)} sub="Consolidado negocio" accent="blue" />
        <KpiCard label="Alertas Activas"              value={toNumber(consolidated?.active_alerts)}        sub="Agregado global" accent="warning" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Tendencia de Ventas" sub="Ingresos diarios del período actual">
          <IncomeChart data={consolidated?.daily_income_trend || []} />
        </Panel>
        <Panel title="Distribución de Gastos" sub="Desglose por categoría" accent="blue">
          <ExpenseBreakdown data={consolidated?.expenses_breakdown || []} />
        </Panel>
      </div>
      <Panel title="Top Productos (Consolidado)" sub="Fuente: campo top_products del endpoint consolidado">
        <AmTable
          headers={['Producto', 'Unidades', 'Ingresos']}
          rows={topProducts.slice(0, 8).map((p) => [p.product_name || 'Producto sin nombre', toNumber(p.units_sold), formatMoney(p.revenue)])}
          emptyMessage="No hay productos para mostrar."
        />
      </Panel>
    </div>
  )
}

function FlujoCajaContent({ dashboard, cajas, loading, error }) {
  const cajasList = safeArray(cajas)
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!dashboard && !loading && !error} emptyMessage="Sin datos de flujo. Completa órdenes desde el POS y registra gastos para ver gráficos." />
  if (loading || error || (!dashboard && !loading && !error)) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Total Ingresos" value={formatMoney(dashboard?.monthly_sales)}     sub="Mes actual" />
        <KpiCard label="Total Gastos"   value={formatMoney(dashboard?.monthly_expenses)}  sub="Mes actual" accent="red" />
        <KpiCard label="Flujo Neto"     value={formatMoney(dashboard?.monthly_cash_flow)} sub="Resultado mensual" accent="blue" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Tendencia de Ingresos" sub="Análisis de ingresos diarios del período actual">
          <IncomeChart data={dashboard?.daily_income_trend || []} />
        </Panel>
        <Panel title="Desglose de Gastos" sub="Distribución de gastos por categoría" accent="red">
          <ExpenseBreakdown data={dashboard?.expenses_breakdown || []} />
        </Panel>
      </div>
      <Panel title="Cajas del Local" sub="Fuente: endpoint /cajas por local">
        <AmTable
          headers={['Nombre Caja', 'Estado', 'ID']}
          rows={cajasList.map((c) => [c.name || 'Caja sin nombre', c.is_active ? 'Activa' : 'Inactiva', String(c.id || '').slice(0, 12)])}
          emptyMessage="No hay cajas registradas para este local."
        />
      </Panel>
    </div>
  )
}

const SEVERITY_CONFIG = {
  critical: { label: 'Crítica',  cls: 'border-red-200 bg-red-50',    badge: 'bg-red-100 text-red-700'    },
  high:     { label: 'Alta',     cls: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  medium:   { label: 'Media',    cls: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  low:      { label: 'Baja',     cls: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-100 text-blue-700'   },
}

function AlertCard({ alert, onResolve, resolving }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium
  const date = alert.created_at
    ? new Date(alert.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <article className={cn('rounded-xl border p-4 shadow-sm', cfg.cls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.badge)}>
              {cfg.label}
            </span>
            {alert.status === 'resolved' && (
              <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Resuelta
              </span>
            )}
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{date}</span>
          </div>
          <h4 className="text-sm font-bold text-[hsl(var(--foreground))]">{alert.title}</h4>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{alert.message}</p>
        </div>
        {alert.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            disabled={resolving === alert.id}
            onClick={() => onResolve(alert.id)}
            className="shrink-0 text-xs h-7"
          >
            {resolving === alert.id ? 'Resolviendo…' : 'Resolver'}
          </Button>
        )}
      </div>
    </article>
  )
}

function AlertasContent({ localId }) {
  const { alerts, loading, error, pendingCount, resolveAlert, evaluateAlerts } = useAlerts(localId)
  const [filter, setFilter] = useState('pending')
  const [resolving, setResolving] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const handleResolve = async (alertId) => {
    setResolving(alertId)
    try {
      await resolveAlert(alertId)
    } catch (e) {
      console.error('Error al resolver alerta:', e)
    } finally {
      setResolving(null)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    setEvalResult(null)
    try {
      const result = await evaluateAlerts()
      setEvalResult(result)
    } catch (e) {
      console.error('Error al evaluar alertas:', e)
    } finally {
      setEvaluating(false)
    }
  }

  if (loading) return <SectionState loading={true} error={null} isEmpty={false} emptyMessage="" />
  if (error) return <SectionState loading={false} error={error} isEmpty={false} emptyMessage="" />

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Alertas Pendientes" value={pendingCount} sub="Requieren atención" accent="warning" />
        <KpiCard label="Resueltas"          value={alerts.filter((a) => a.status === 'resolved').length} sub="Total historial" />
        <KpiCard label="Total Historial"    value={alerts.length} sub="Todas las alertas" accent="blue" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {[
            { key: 'pending',  label: 'Pendientes' },
            { key: 'resolved', label: 'Resueltas' },
            { key: 'all',      label: 'Todas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                filter === key
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--border))]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={evaluating}
          onClick={handleEvaluate}
          className="text-xs"
        >
          {evaluating ? 'Evaluando reglas…' : 'Evaluar reglas ahora'}
        </Button>
      </div>

      {/* Eval result feedback */}
      {evalResult && (
        <div className={cn('rounded-lg border p-3 text-xs', evalResult.alerts_created > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-800')}>
          {evalResult.alerts_created > 0
            ? `Se generaron ${evalResult.alerts_created} nueva(s) alerta(s).`
            : 'Todo en orden. No se detectaron condiciones de alerta.'}
        </div>
      )}

      {/* Alert list */}
      <Panel title={`Alertas — ${filter === 'pending' ? 'Pendientes' : filter === 'resolved' ? 'Resueltas' : 'Todas'}`} sub="Actualización automática cada 30 segundos">
        {filtered.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {filter === 'pending' ? 'No hay alertas pendientes. El sistema está operando con normalidad.' : 'No hay alertas en este filtro.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onResolve={handleResolve} resolving={resolving} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function SetGoalForm({ localId, onSaved }) {
  const [amount,  setAmount]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')
  const [ok,      setOk]      = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { setErr('Ingresa un monto válido'); return }
    setSaving(true); setErr(''); setOk(false)
    try {
      const now = new Date()
      // POST crea o actualiza (el backend hace upsert por local_id+mes+año)
      await apiRequest('/goals', {
        method: 'POST',
        body: {
          local_id:      localId,
          target_amount: amt,
          period_month:  now.getMonth() + 1,
          period_year:   now.getFullYear(),
        },
      })
      setOk(true); setAmount('')
      onSaved?.()
    } catch (e) {
      setErr(e?.message || 'Error al guardar meta')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 pt-2">
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          Nueva meta mensual (CLP)
        </label>
        <input
          type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Ej. 3000000"
          className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar meta'}</Button>
      {err && <span className="text-xs text-red-600">{err}</span>}
      {ok  && <span className="text-xs text-emerald-600">✓ Meta guardada</span>}
    </form>
  )
}

function BonosContent({ dashboard, loading, error, localId, onRefresh }) {
  const stateNode = <SectionState loading={loading} error={error} isEmpty={false} emptyMessage="" />
  if (loading || error) return stateNode

  const goal = dashboard?.monthly_goal || {}
  const progress = Math.max(0, Math.min(100, toNumber(goal.progress_percentage)))
  const hasGoal = toNumber(goal.target_amount) > 0

  return (
    <div className="space-y-5">
      {hasGoal && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard label="Meta Mensual"    value={formatMoney(goal.target_amount)}   sub="Objetivo configurado" />
          <KpiCard label="Monto Alcanzado" value={formatMoney(goal.achieved_amount)} sub="Ventas acumuladas" accent="blue" />
          <KpiCard label="Progreso"        value={`${progress.toFixed(1)}%`}          sub="Porcentaje de cumplimiento" accent="purple" />
        </div>
      )}
      <Panel title="Meta Mensual de Ventas" sub="Configura el objetivo de ventas para el mes actual">
        {hasGoal && (
          <>
            <ProgressBar value={progress} />
            <div className="mt-3 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
              <span>Alcanzado: {formatMoney(goal.achieved_amount)}</span>
              <span>Restante: {formatMoney(goal.remaining_amount)}</span>
            </div>
          </>
        )}
        {!hasGoal && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
            No hay meta configurada para este mes. Define una para ver el progreso.
          </p>
        )}
        {localId && <SetGoalForm localId={localId} onSaved={onRefresh} />}
      </Panel>
    </div>
  )
}

// ── Modal Nuevo Gasto ──────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'supplies',    label: 'Insumos'       },
  { value: 'utilities',   label: 'Servicios'     },
  { value: 'maintenance', label: 'Mantención'    },
  { value: 'staff',       label: 'Personal'      },
  { value: 'other',       label: 'Otros'         },
]

function NuevoGastoModal({ localId, onClose, onSaved }) {
  const [category,    setCategory]    = useState('other')
  const [amount,      setAmount]      = useState('')
  const [description, setDescription] = useState('')
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { setErr('Ingresa un monto válido'); return }
    setSaving(true); setErr('')
    try {
      await postExpense({
        local_id:     localId,
        category,
        amount:       amt,
        description:  description.trim() || null,
        expense_date: new Date(date).toISOString(),
      })
      onSaved()
      onClose()
    } catch (e) { setErr(e?.message || 'Error al guardar'); setSaving(false) }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nuevo Gasto</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">✕</button>
        </div>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Monto (CLP)</label>
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Descripción (opcional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle del gasto" className={inputCls} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar gasto'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Reportar Transferencia ───────────────────────────

function ReportarTransferenciaModal({ localId, onClose, onSaved }) {
  const [amount,     setAmount]     = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { setErr('Ingresa un monto válido'); return }
    setSaving(true); setErr('')
    try {
      await postTransfer({
        local_id:    localId,
        amount:      amt,
        receipt_url: receiptUrl.trim() || null,
      })
      onSaved()
      onClose()
    } catch (e) { setErr(e?.message || 'Error al guardar'); setSaving(false) }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Reportar Transferencia</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">✕</button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Registra una transferencia de dinero del dueño al local.</p>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Monto (CLP)</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">URL Comprobante (opcional)</label>
            <input type="url" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Reportar transferencia'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function renderSectionContent(activeSection, payload) {
  switch (activeSection) {
    case 'dashboard': {
      const enrichedDashboard = enrichDashboardWithChartData(payload.dashboard)
      const incomeData = generateIncomeTrendFromOrders(payload.orders)
      const expenseData = generateExpenseBreakdownFromData(payload.expenses)
      return <DashboardContent dashboard={{ ...enrichedDashboard, daily_income_trend: incomeData, expenses_breakdown: expenseData }} loading={payload.loading} error={payload.error} />
    }
    case 'ventas':
      return <VentasContent orders={payload.orders} loading={payload.loading} error={payload.error} />
    case 'rendiciones':
      return <RendicionesContent rendiciones={payload.rendiciones} expenses={payload.expenses} transfers={payload.transfers} loading={payload.loading} error={payload.error} />
    case 'reportes': {
      const reportesIncome   = generateIncomeTrendFromOrders(payload.orders)
      const reportesExpenses = generateExpenseBreakdownFromData(payload.expenses)
      const enrichedConsolidated = payload.consolidated
        ? { ...payload.consolidated, daily_income_trend: reportesIncome, expenses_breakdown: reportesExpenses }
        : null
      return <ReportesContent consolidated={enrichedConsolidated} loading={payload.loading} error={payload.error} />
    }
    case 'flujo-caja': {
      const flujoDashboard = enrichDashboardWithChartData(payload.dashboard)
      const flujoExpenseData = generateExpenseBreakdownFromData(payload.expenses)
      return <FlujoCajaContent dashboard={{ ...flujoDashboard, expenses_breakdown: flujoExpenseData }} cajas={payload.cajas} loading={payload.loading} error={payload.error} />
    }
    case 'alertas':
      return <AlertasContent localId={payload.localId} />
    case 'bonos':
      return <BonosContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} localId={payload.localId} onRefresh={payload.onRefresh} />
    default: {
      const defaultDashboard = enrichDashboardWithChartData(payload.dashboard)
      const defaultIncomeData = generateIncomeTrendFromOrders(payload.orders)
      const defaultExpenseData = generateExpenseBreakdownFromData(payload.expenses)
      return <DashboardContent dashboard={{ ...defaultDashboard, daily_income_trend: defaultIncomeData, expenses_breakdown: defaultExpenseData }} loading={payload.loading} error={payload.error} />
    }
  }
}

// ── Main component ─────────────────────────────────────────────

function AdministrativeModule() {
  const navigate = useNavigate()
  const { localId, sectionId } = useParams()
  const [sectionData, setSectionData] = useState({
    dashboard: null, orders: [], rendiciones: null,
    expenses: [], transfers: [], consolidated: null, cajas: [],
  })
  const [loading, setLoading] = useState(false)
  const [sectionError, setSectionError] = useState('')
  const [showNuevoGasto, setShowNuevoGasto]             = useState(false)
  const [showNuevaTransferencia, setShowNuevaTransferencia] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const selectedLocal = useSelectedLocal(localId, 'state-then-locales')

  const activeSection = sections.some((s) => s.id === sectionId) ? sectionId : 'dashboard'
  const activeSectionMeta = sections.find((s) => s.id === activeSection) || sections[0]

  useEffect(() => {
    let ignore = false
    async function fetchSectionData() {
      if (!localId) return
      setLoading(true)
      setSectionError('')
      try {
        const { token, businessId } = await getAuthContext()
        const updates = {}
        if (['dashboard', 'flujo-caja', 'bonos'].includes(activeSection)) {
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
          if (!businessId) throw new Error('No se encontró business_id en el token para obtener reportes consolidados')
          const [consolidated, orders, expenses] = await Promise.all([
            getConsolidatedDashboard(businessId, token),
            getOrdersByLocal(localId, token),
            getExpensesByLocal(localId, token),
          ])
          updates.consolidated = consolidated
          updates.orders       = safeArray(orders)
          updates.expenses     = safeArray(expenses)
        }
        if (activeSection === 'flujo-caja') {
          updates.cajas = await getCajasByLocal(localId, token)
        }
        if (!ignore) setSectionData((prev) => ({ ...prev, ...updates }))
      } catch (error) {
        if (!ignore) setSectionError(error.message || 'No se pudo cargar la información del módulo')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    fetchSectionData()
    return () => { ignore = true }
  }, [localId, activeSection, refreshKey])

  const handleGoModules = () => navigate('/admin', { state: { local: selectedLocal, focusLocalId: localId } })

  return (
    <>
      {showNuevoGasto && (
        <NuevoGastoModal
          localId={localId}
          onClose={() => setShowNuevoGasto(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {showNuevaTransferencia && (
        <ReportarTransferenciaModal
          localId={localId}
          onClose={() => setShowNuevaTransferencia(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      <header className="shrink-0 flex items-center justify-between border-b border-[hsl(var(--border))] bg-white px-6 py-3 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-[hsl(var(--primary))]">{activeSectionMeta.label}</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {selectedLocal?.name || localId || 'Sin local'} · Módulo Administrativo
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[hsl(var(--primary))] tracking-tight">
              {activeSectionMeta.label}
            </h2>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{activeSectionMeta.subtitle}</p>
            <Badge variant="ghost" className="mt-2 text-xs">
              Local: {selectedLocal?.name || localId || 'No identificado'}
            </Badge>
          </div>
          <SectionActions
            activeSection={activeSection}
            onNuevoGasto={() => setShowNuevoGasto(true)}
            onNuevaTransferencia={() => setShowNuevaTransferencia(true)}
          />
        </div>

        {renderSectionContent(activeSection, {
          ...sectionData,
          loading,
          error:    sectionError,
          localId,
          onRefresh: () => setRefreshKey(k => k + 1),
        })}
      </main>
    </>
  )
}

export default AdministrativeModule
