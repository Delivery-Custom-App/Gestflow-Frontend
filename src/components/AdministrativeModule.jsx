import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { WORKER_ROLES, ADMIN_ROLES } from '../constants/roles'
import { formatShortAddress } from '../lib/formatAddress'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../hooks/useSelectedLocal'
import { parseApiDate } from '../utils/chileDateTime'
import { getLocalById } from '../lib/inventoryApi'
import { useAlerts } from '../hooks/useAlerts'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import ExpenseBreakdown from './charts/ExpenseBreakdown'
import CajaMpPairingModal from './pos/CajaMpPairingModal'
import { isV2FeatureEnabled } from '../lib/v2Features'
import {
  getCajasByLocal,
  getConsolidatedDashboard,
  getExpensesByLocal,
  getLocalDashboard,
  getOrdersByLocal,
  getRendicionesDashboard,
  getTransfersByLocal,
  patchExpense,
  patchTransfer,
  postExpense,
  postTransfer,
  createCaja,
  getCajaResumen,
  getMovimientosCaja,
} from '../lib/administrativeApi'
import { getAuthContext, apiRequest } from '../lib/apiClient'
import { uploadReceipt } from '../lib/uploadApi'
import { enrichDashboardWithChartData, generateIncomeTrendFromOrders, generateExpenseBreakdownFromData } from '../utils/chartDataHelpers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, TrendingDown, Send, X, Upload, ImageIcon, ChevronDown, ChevronUp, ChevronRight, ShoppingCart, HelpCircle, BarChart2, CreditCard, ArrowLeftRight, Bell, Award, LayoutDashboard } from 'lucide-react'

const sections = [
  { id: 'dashboard',   label: 'Dashboard',      subtitle: 'Resumen general del sistema' },
  { id: 'ventas',      label: 'Ventas',          subtitle: 'Ventas del dia con desglose' },
  { id: 'rendiciones', label: 'Rendiciones',     subtitle: 'Resumen de transferencias dueno a local' },
  { id: 'reportes',    label: 'Reportes',        subtitle: 'Ventas, flujo y comparativas por periodo' },
  { id: 'flujo-caja',  label: 'Caja Virtual',   subtitle: 'Resumen monetario por periodo de tiempo' },
  { id: 'alertas',     label: 'Alertas',         subtitle: 'Sistema de alertas administrativas del local' },
  { id: 'bonos',          label: 'Bonos',           subtitle: 'Resumen de bonos por meta cumplida' },
  { id: 'configuracion', label: 'Configuración',   subtitle: 'Dispositivos POS y ajustes del local' },
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
  if (value === 'mercadopago_point' || value.includes('mercadopago')) return 'MercadoPago'
  if (value.includes('cash') || value.includes('efectivo')) return 'Efectivo'
  if (value.includes('debit') || value.includes('debito')) return 'Debito'
  if (value.includes('credit') || value.includes('credito')) return 'Credito'
  if (value.includes('transfer')) return 'Transferencia'
  return 'Otro'
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = parseApiDate(value)
  if (!date) return 'Sin fecha'
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
    hour12: true,
  })
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

const KPI_ACCENT = {
  warning: {
    bar:   'border-l-amber-500',
    bg:    'bg-amber-500/10 dark:bg-amber-500/15',
    ring:  'ring-1 ring-amber-400/30',
    value: 'text-amber-600 dark:text-amber-400',
    dot:   'bg-amber-500',
  },
  red: {
    bar:   'border-l-red-500',
    bg:    'bg-red-500/10 dark:bg-red-500/15',
    ring:  'ring-1 ring-red-400/30',
    value: 'text-red-600 dark:text-red-400',
    dot:   'bg-red-500',
  },
  blue: {
    bar:   'border-l-blue-500',
    bg:    'bg-blue-500/10 dark:bg-blue-500/15',
    ring:  'ring-1 ring-blue-400/30',
    value: 'text-blue-600 dark:text-blue-400',
    dot:   'bg-blue-500',
  },
  purple: {
    bar:   'border-l-violet-500',
    bg:    'bg-violet-500/10 dark:bg-violet-500/15',
    ring:  'ring-1 ring-violet-400/30',
    value: 'text-violet-600 dark:text-violet-400',
    dot:   'bg-violet-500',
  },
}

const KPI_DEFAULT = {
  bar:   'border-l-emerald-600',
  bg:    'bg-emerald-500/10 dark:bg-emerald-500/15',
  ring:  'ring-1 ring-emerald-400/30',
  value: 'text-emerald-700 dark:text-emerald-400',
  dot:   'bg-emerald-600',
}

function KpiCard({ label, value, sub, accent }) {
  const a = KPI_ACCENT[accent] || KPI_DEFAULT
  return (
    <article className={cn('rounded-xl border-l-[5px] p-4 shadow-md', a.bar, a.bg, a.ring)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', a.dot)} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{label}</p>
      </div>
      <strong className={cn('block text-2xl font-extrabold leading-tight', a.value)}>{value}</strong>
      {sub && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{sub}</span>}
    </article>
  )
}

const PANEL_ACCENT = {
  blue:    'border-blue-400/40 bg-blue-500/5 dark:bg-blue-500/10',
  red:     'border-red-400/40  bg-red-500/5  dark:bg-red-500/10',
  warning: 'border-amber-400/40 bg-amber-500/5 dark:bg-amber-500/10',
}

function Panel({ title, sub, accent, children }) {
  const accentCls = PANEL_ACCENT[accent] || 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
  return (
    <article className={cn('rounded-xl border p-5 shadow-sm', accentCls)}>
      {title && <h3 className="mb-0.5 text-sm font-bold text-[hsl(var(--foreground))]">{title}</h3>}
      {sub && <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
      {children}
    </article>
  )
}

function RowCard({ title, sub, meta, pill, receiptUrl }) {
  return (
    <article className="flex items-start justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-bold text-[hsl(var(--foreground))]">{title}</strong>
        {sub && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
        {meta && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{meta}</span>}
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] underline underline-offset-2 hover:opacity-75">
            Ver comprobante
          </a>
        )}
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

function SectionActions({ activeSection, onNuevoGasto, onNuevaTransferencia, onNuevaCaja }) {
  if (activeSection === 'ventas') {
    return null
  }
  if (activeSection === 'rendiciones') {
    if (!isV2FeatureEnabled('rendiciones')) return null
    return (
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNuevoGasto}>+ Nuevo Gasto</Button>
        <Button onClick={onNuevaTransferencia}>Reportar Transferencia</Button>
      </div>
    )
  }
  if (activeSection === 'flujo-caja') {
    return (
      <div className="flex gap-2">
        <Button onClick={onNuevaCaja}>+ Nueva Caja</Button>
      </div>
    )
  }
  return null
}

function SectionState({ loading, error, isEmpty, emptyMessage }) {
  if (!loading && !error && !isEmpty) return null
  return (
    <div className={cn('rounded-xl border p-6', error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]')}>
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
        <KpiCard label="Caja Virtual"    value={formatMoney(dashboard?.monthly_cash_flow)} sub="Ingresos − Gastos" />
        <KpiCard label="Alertas Activas" value={toNumber(dashboard?.active_alerts)}       sub="Requieren atención" accent="warning" />
      </div>

      {/* Fila 2 — métricas operativas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ticket Promedio"   value={formatMoney(dashboard?.avg_ticket)}        sub="Por orden este mes" accent="blue" />
        <KpiCard label="Stock Crítico"     value={toNumber(dashboard?.stock_critical_count)} sub={`${toNumber(dashboard?.stock_out_count)} sin stock`} accent="warning" />
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

const PERIOD_OPTIONS = [
  { id: 'week',  label: 'Semanal' },
  { id: 'month', label: 'Mensual' },
  { id: 'year',  label: 'Anual' },
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function santiagoYmd(iso) {
  const d = parseApiDate(iso)
  if (!d) return null
  const ymd = d.toLocaleString('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })
  return ymd.length === 10 ? ymd : null
}

function periodMeta(ymd, granularity) {
  const [y, m, d] = ymd.split('-').map(Number)
  if (granularity === 'year') {
    return { key: String(y), label: `Año ${y}`, sortKey: y, range: String(y) }
  }
  if (granularity === 'month') {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = `${MONTH_NAMES[m - 1]} ${y}`
    return { key, label, sortKey: y * 12 + (m - 1), range: label }
  }
  const base = new Date(Date.UTC(y, m - 1, d))
  const diffToMon = (base.getUTCDay() + 6) % 7
  const mon = new Date(base.getTime() - diffToMon * 86400000)
  const sun = new Date(mon.getTime() + 6 * 86400000)
  const fmt = (dt) => `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
  return {
    key: mon.toISOString().slice(0, 10),
    label: `Semana del ${fmt(mon)} al ${fmt(sun)}`,
    sortKey: mon.getTime(),
    range: `Semana ${fmt(mon)} — ${fmt(sun)}`,
  }
}

function VentasContent({ orders, loading, error }) {
  const all = safeArray(orders)
  const [granularity, setGranularity] = useState('month')
  const [expandedKey, setExpandedKey] = useState(null)

  // Últimas 24 horas (ventana rodante)
  const cutoff24h = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), [])
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

  // ── Histórico consolidado por período ──
  const buckets = useMemo(() => {
    const map = new Map()
    for (const o of all) {
      if (_normalizeOrderStatus(o.status) === 'cancelled') continue
      const ymd = santiagoYmd(o.created_at)
      if (!ymd) continue
      const meta = periodMeta(ymd, granularity)
      if (!map.has(meta.key)) {
        map.set(meta.key, { ...meta, total: 0, count: 0, orders: [] })
      }
      const bucket = map.get(meta.key)
      bucket.total += getOrderAmount(o)
      bucket.count += 1
      bucket.orders.push(o)
    }
    return [...map.values()].sort((a, b) => (a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0))
  }, [all, granularity])

  const histTotal = buckets.reduce((s, b) => s + b.total, 0)
  const histCount = buckets.reduce((s, b) => s + b.count, 0)
  const histAvg = histCount ? histTotal / histCount : 0

  const methodBreakdown = useMemo(() => {
    const acc = {}
    for (const o of all) {
      if (_normalizeOrderStatus(o.status) === 'cancelled') continue
      const method = normalizePaymentMethod(o?.payment_method)
      acc[method] = (acc[method] || 0) + getOrderAmount(o)
    }
    return Object.entries(acc)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
  }, [all])

  const methodTotal = methodBreakdown.reduce((s, m) => s + m.total, 0)
  const periodNoun = granularity === 'week' ? 'semanas' : granularity === 'month' ? 'meses' : 'años'

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

      <Panel title="Histórico y Consolidados" sub="Registros consolidados por período. Excluye órdenes canceladas.">
        <div className="mb-5 inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setGranularity(opt.id); setExpandedKey(null) }}
              className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                granularity === opt.id
                  ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Consolidado" value={formatMoney(histTotal)} sub={`${histCount} ventas`} />
          <KpiCard label="Ticket Promedio"   value={formatMoney(histAvg)}   sub="Por venta" accent="blue" />
          <KpiCard label="Períodos"          value={String(buckets.length)} sub={periodNoun} accent="purple" />
          <KpiCard label="Mayor Período"     value={formatMoney(buckets[0]?.total || 0)} sub={buckets[0]?.label || 'Sin ventas'} accent="warning" />
        </div>

        {buckets.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay ventas históricas registradas.</p>
        ) : (
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const isOpen = expandedKey === bucket.key
              const pct = histTotal ? (bucket.total / histTotal) * 100 : 0
              const bucketAvg = bucket.count ? bucket.total / bucket.count : 0
              return (
                <div key={bucket.key} className="rounded-lg border border-[hsl(var(--border))]">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isOpen ? null : bucket.key)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors hover:bg-[hsl(var(--muted)/40)]">
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen
                        ? <ChevronUp size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                        : <ChevronRight size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-[hsl(var(--foreground))]">{bucket.label}</strong>
                        <span className="block text-xs text-[hsl(var(--muted-foreground))]">{bucket.count} venta{bucket.count !== 1 ? 's' : ''} · {formatMoney(bucketAvg)} promedio</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(bucket.total)}</strong>
                      <span className="block text-xs text-[hsl(var(--muted-foreground))]">{pct.toFixed(0)}% del total</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-[hsl(var(--border))] p-3">
                      {bucket.orders.map((order) => (
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
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Distribución por Método de Pago" sub={`Histórico consolidado ${granularity === 'week' ? 'semanal' : granularity === 'month' ? 'mensual' : 'anual'}`}>
        {methodBreakdown.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos de métodos de pago.</p>
        ) : (
          <div className="space-y-3">
            {methodBreakdown.map((m) => {
              const pct = methodTotal ? (m.total / methodTotal) * 100 : 0
              return (
                <div key={m.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">{m.label}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{formatMoney(m.total)} · {pct.toFixed(0)}%</span>
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
  )
}

const MOVEMENT_STATUS_LABEL = {
  pending:   'Pendiente',
  approved:  'Aprobado',
  rejected:  'Rechazado',
  completed: 'Completado',
  failed:    'Fallido',
}

function statusBucket(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return 'pending'
  if (s === 'approved' || s === 'completed') return 'confirmed'
  if (s === 'rejected' || s === 'failed') return 'rejected'
  return 'other'
}

function RendicionesContent({ rendiciones, expenses, transfers, loading, error, onRefresh }) {
  const { userRole } = useAuth()
  const canVerify = ADMIN_ROLES.includes(userRole)
  const rendicionesEnabled = isV2FeatureEnabled('rendiciones')

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const expensesList = safeArray(expenses)
  const transfersList = safeArray(transfers)
  const movements = safeArray(rendiciones?.movements)

  const movementRows = useMemo(() => {
    if (expensesList.length === 0 && transfersList.length === 0 && movements.length > 0) {
      return movements.map((m) => ({
        id: m.id,
        type: m.movement_type === 'transfer' ? 'transfer' : 'expense',
        amount: toNumber(m.amount),
        status: m.status || 'pending',
        occurred_at: m.occurred_at,
        description: m.movement_type === 'transfer' ? 'Rendición al centro de control' : (m.description || ''),
        category: 'other',
        receipt_url: m.receipt_url,
      }))
    }
    return [
      ...expensesList.map((item) => ({
        id: item.id,
        type: 'expense',
        amount: toNumber(item.amount),
        status: String(item.status || 'pending').toLowerCase(),
        occurred_at: item.expense_date || item.created_at,
        description: item.description || '',
        category: item.category || 'other',
        receipt_url: item.receipt_url,
      })),
      ...transfersList.map((item) => ({
        id: item.id,
        type: 'transfer',
        amount: toNumber(item.amount),
        status: String(item.status || 'pending').toLowerCase(),
        occurred_at: item.created_at,
        description: item.description || 'Rendición al centro de control',
        receipt_url: item.receipt_url,
      })),
    ]
  }, [expensesList, transfersList, movements])

  const rows = useMemo(() => movementRows
    .filter((r) => (typeFilter === 'all' ? true : r.type === typeFilter))
    .filter((r) => (statusFilter === 'all' ? true : statusBucket(r.status) === statusFilter))
    .sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0)),
  [movementRows, typeFilter, statusFilter])

  if (!rendicionesEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-6 space-y-2">
        <p className="text-sm font-semibold">Rendiciones aún no disponibles</p>
        <p className="text-sm text-amber-800/90">
          Gastos, transferencias y el dashboard de rendiciones todavía no están migrados a Backend V2.
          Esta sección se habilitará cuando existan esos endpoints.
        </p>
      </div>
    )
  }

  const pendingRows = movementRows.filter((r) => statusBucket(r.status) === 'pending')

  const isEmpty = !rendiciones && movementRows.length === 0 && !loading && !error
  const stateNode = <SectionState loading={loading} error={error} isEmpty={isEmpty} emptyMessage="Sin movimientos aún. Usa los botones 'Nuevo Gasto' y 'Reportar Transferencia' para registrar." />
  if (loading || error || isEmpty) return stateNode

  const acc = {}
  for (const e of expensesList) {
    const key = e.category || 'other'
    acc[key] = (acc[key] || 0) + toNumber(e.amount)
  }
  const expenseBreakdown = Object.entries(acc)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ category: EXPENSE_LABEL[k] || k, amount: v }))
    .sort((a, b) => b.amount - a.amount)

  async function handleVerify(row, nextStatus) {
    if (busyId) return
    setBusyId(row.id)
    setActionError('')
    try {
      if (row.type === 'expense') await patchExpense(row.id, { status: nextStatus })
      else await patchTransfer(row.id, { status: nextStatus })
      onRefresh?.()
    } catch (e) {
      setActionError(e.message || 'No se pudo actualizar el movimiento')
    } finally {
      setBusyId(null)
    }
  }

  const actionOptions = (row) => {
    if (row.type === 'transfer') return [
      { label: 'Confirmar', status: 'completed', variant: 'default' },
      { label: 'Rechazar',  status: 'failed',    variant: 'danger' },
    ]
    return [
      { label: 'Aprobar',  status: 'approved', variant: 'default' },
      { label: 'Rechazar', status: 'rejected', variant: 'danger' },
    ]
  }

  const TYPE_FILTERS = [
    { id: 'all',   label: 'Todos' },
    { id: 'expense',  label: 'Compras' },
    { id: 'transfer', label: 'Transferencias' },
  ]
  const STATUS_FILTERS = [
    { id: 'all',      label: 'Todos' },
    { id: 'pending',  label: 'Pendientes' },
    { id: 'confirmed', label: 'Aprobados' },
    { id: 'rejected', label: 'Rechazados' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Rendido"         value={formatMoney(rendiciones?.completed_transfers_total)} sub="Transferido al centro de control" />
        <KpiCard label="Ingresos Registrados"  value={formatMoney(rendiciones?.approved_expenses_total)}  sub="Período consultado" accent="blue" />
        <KpiCard label="Consolidado Período"   value={formatMoney(rendiciones?.net_flow)}                 sub="Ingresos − rendiciones" accent="blue" />
        <KpiCard label="Por Regularizar"       value={formatMoney(toNumber(rendiciones?.pending_expenses_total) + toNumber(rendiciones?.pending_transfers_total))} sub={`${pendingRows.length} movimiento${pendingRows.length !== 1 ? 's' : ''} pendiente${pendingRows.length !== 1 ? 's' : ''}`} accent="warning" />
      </div>
      <Panel title="Distribución de Gastos" sub="Gastos del período por categoría" accent="red">
        <ExpenseBreakdown data={expenseBreakdown} />
      </Panel>
      <Panel title="Verificar Movimientos" sub="Compras (gastos) y transferencias electrónicas. Aprueba o rechaza los pendientes para regularizar cada movimiento.">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
            {TYPE_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  typeFilter === opt.id
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="inline-flex w-fit rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  statusFilter === opt.id
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {actionError && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Error: {actionError}</p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay movimientos que coincidan con los filtros.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const isPending = statusBucket(row.status) === 'pending'
              return (
                <div key={`${row.type}-${row.id}`} className="rounded-lg border border-[hsl(var(--border))]">
                  <RowCard
                    title={formatMoney(row.amount)}
                    sub={`${row.type === 'transfer' ? 'Rendición' : 'Compra'} — ${formatDateTime(row.occurred_at)}`}
                    meta={row.type === 'transfer'
                      ? row.description
                      : `${EXPENSE_LABEL[row.category] || row.category}${row.description ? ` — ${row.description}` : ''}`}
                    pill={MOVEMENT_STATUS_LABEL[row.status] || row.status}
                    receiptUrl={row.receipt_url || null}
                  />
                  {canVerify && isPending && (
                    <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-3 py-2">
                      {actionOptions(row).map((a) => (
                        <Button
                          key={a.status}
                          size="sm"
                          variant={a.variant}
                          disabled={busyId !== null}
                          onClick={() => handleVerify(row, a.status)}>
                          {busyId === row.id ? 'Guardando...' : a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {!canVerify && isPending && (
                    <div className="border-t border-[hsl(var(--border))] px-3 py-2 text-right text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Solo administradores pueden verificar
                    </div>
                  )}
                </div>
              )
            })}
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
      {consolidated?._source === 'orders_v2' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Métricas calculadas desde las órdenes del local en Backend V2. Gastos, metas y consolidado multi-local
          aún no están migrados.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ventas Diarias (Consolidado)" value={formatMoney(consolidated?.daily_sales)}      sub={`${toNumber(consolidated?.local_count)} locales`} />
        <KpiCard label="Ventas Mensuales"             value={formatMoney(consolidated?.monthly_sales)}     sub="Consolidado negocio" />
        <KpiCard label="Caja Virtual Mensual"         value={formatMoney(consolidated?.monthly_cash_flow)} sub="Consolidado negocio" accent="blue" />
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

const MP_PAIRING_BADGE = {
  unprovisioned:    { label: 'Sin vincular',      variant: 'secondary' },
  awaiting_pairing: { label: 'Esperando terminal', variant: 'warning' },
  paired:           { label: 'Vinculada',          variant: 'success' },
}

const MP_PAIRING_ACTION = {
  unprovisioned:    'Vincular MP',
  awaiting_pairing: 'Verificar vinculación',
  paired:           'Ver vinculación',
}

function FlujoCajaContent({ dashboard, cajas, loading, error, onManagePairing, onViewMovimientos }) {
  const cajasList = safeArray(cajas)
  const showMpPairing = typeof onManagePairing === 'function'
  const showMovimientos = typeof onViewMovimientos === 'function'
  const showActions = showMpPairing || showMovimientos
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!dashboard && !loading && !error} emptyMessage="Sin datos de flujo. Completa órdenes desde el POS y registra gastos para ver gráficos." />
  if (loading || error || (!dashboard && !loading && !error)) return stateNode

  const headers = [
    'Nombre Caja',
    'Estado',
    ...(showMpPairing ? ['MercadoPago'] : []),
    ...(showActions ? ['Acciones'] : []),
  ]

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
          headers={headers}
          rows={cajasList.map((c) => {
            const row = [
              c.name || 'Caja sin nombre',
              c.is_active ? 'Abierta' : (c.status === 'closed' ? 'Cerrada' : (c.is_active ? 'Activa' : 'Inactiva')),
            ]
            if (showMpPairing) {
              const status = c.mp?.pairing_status || 'unprovisioned'
              const badge = MP_PAIRING_BADGE[status] || MP_PAIRING_BADGE.unprovisioned
              row.push(
                <div className="flex items-center gap-2" key={`mp-${c.id}`}>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {status === 'paired' && c.mp?.terminal_id && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{c.mp.terminal_id}</span>
                  )}
                </div>,
              )
            }
            if (showActions) {
              row.push(
                <div className="flex items-center gap-2" key={`actions-${c.id}`}>
                  {showMovimientos && (
                    <Button size="sm" variant="outline" onClick={() => onViewMovimientos(c)}>
                      Ver movimientos
                    </Button>
                  )}
                  {showMpPairing && (
                    <Button size="sm" variant="outline" onClick={() => onManagePairing(c)}>
                      {MP_PAIRING_ACTION[c.mp?.pairing_status || 'unprovisioned'] || MP_PAIRING_ACTION.unprovisioned}
                    </Button>
                  )}
                </div>,
              )
            }
            return row
          })}
          emptyMessage="No hay cajas registradas para este local."
        />
      </Panel>
    </div>
  )
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítica',
    cls:   'border-l-4 border-l-red-500 border border-red-200 bg-red-50 dark:border-slate-700 dark:border-l-red-500 dark:bg-red-950/30',
    badge: 'bg-red-500 text-white',
  },
  high: {
    label: 'Alta',
    cls:   'border-l-4 border-l-orange-500 border border-orange-200 bg-orange-50 dark:border-slate-700 dark:border-l-orange-500 dark:bg-orange-950/30',
    badge: 'bg-orange-500 text-white',
  },
  medium: {
    label: 'Media',
    cls:   'border-l-4 border-l-amber-400 border border-amber-200 bg-amber-50 dark:border-slate-700 dark:border-l-amber-400 dark:bg-amber-950/20',
    badge: 'bg-amber-400 text-white',
  },
  low: {
    label: 'Baja',
    cls:   'border-l-4 border-l-blue-400 border border-blue-200 bg-blue-50 dark:border-slate-700 dark:border-l-blue-400 dark:bg-blue-950/20',
    badge: 'bg-blue-400 text-white',
  },
}

const ALERT_TYPE_CONFIG = {
  inventory_stock: {
    label:    'Inventario',
    chipCls:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    actionLabel: 'Ver pedidos',
    route:    (localId) => `/local/${localId}/inventario/compras-semanales`,
  },
  manual: {
    label:    'Manual',
    chipCls:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    actionLabel: null,
    route:    null,
  },
}

function AlertCard({ alert, isSelected, onToggleSelect, isWorker }) {
  const cfg         = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium
  const orderPlaced = alert.metadata?.order_placed === true
  const isPending   = alert.status === 'pending'
  const date        = alert.created_at
    ? new Date(alert.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <article className={cn('rounded-xl p-4 shadow-sm flex items-start gap-3', cfg.cls)}>
      {isPending && onToggleSelect && !isWorker && (
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggleSelect(alert.id)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[hsl(var(--primary))]"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.badge)}>
            {cfg.label}
          </span>
          {orderPlaced && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              <ShoppingCart size={9} />
              Se necesita Pedido
            </span>
          )}
          {alert.status === 'resolved' && (
            <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {orderPlaced ? 'Solucionada vía pedido' : 'Solucionada'}
            </span>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{date}</span>
        </div>
        <h4 className="text-sm font-bold text-[hsl(var(--foreground))]">{alert.title}</h4>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{alert.message}</p>
      </div>
    </article>
  )
}

function dateDayLabel(isoString) {
  if (!isoString) return ''
  const d     = new Date(isoString)
  const today = new Date()
  const isToday =
    d.getDate()     === today.getDate() &&
    d.getMonth()    === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isYesterday =
    d.getDate()     === yesterday.getDate() &&
    d.getMonth()    === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isToday)     return 'Hoy'
  if (isYesterday) return 'Ayer'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function AlertGroup({ type, typeAlerts, localId, onRefresh, isWorker }) {
  const showResolve = type !== 'inventory'
  const navigate = useNavigate()
  const [open, setOpen]           = useState(true)
  const [marking, setMarking]     = useState(false)
  const [resolving, setResolving] = useState(false)
  const [selected, setSelected]   = useState(new Set())
  const typeCfg = ALERT_TYPE_CONFIG[type] || { label: type, chipCls: 'bg-slate-100 text-slate-600', route: null }

  const byDay = useMemo(() => {
    const sorted = [...typeAlerts].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    )
    const map = new Map()
    for (const a of sorted) {
      const label = dateDayLabel(a.created_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label).push(a)
    }
    return map
  }, [typeAlerts])

  const pendingAlerts = typeAlerts.filter((a) => a.status === 'pending')
  const pendingIds    = pendingAlerts.map((a) => a.id)

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectAll = () => setSelected(new Set(pendingIds))
  const clearAll  = () => setSelected(new Set())

  const handlePedidos = async (e) => {
    e.stopPropagation()
    if (pendingIds.length > 0) {
      setMarking(true)
      try {
        const { token } = await getAuthContext()
        await Promise.all(pendingIds.map((id) => markOrderPlaced(id, token)))
        onRefresh?.()
      } catch { /* silencioso */ } finally { setMarking(false) }
    }
    if (typeCfg.route) navigate(typeCfg.route(localId))
  }

  const handleResolveSelected = async (e) => {
    e.stopPropagation()
    const ids = [...selected].filter((id) => pendingIds.includes(id))
    if (!ids.length) return
    setResolving(true)
    try {
      const { token } = await getAuthContext()
      await Promise.all(ids.map((id) => resolveAlert(id, token)))
      setSelected(new Set())
      onRefresh?.()
    } catch { /* silencioso */ } finally { setResolving(false) }
  }

  const handleResolveAll = async (e) => {
    e.stopPropagation()
    if (!pendingIds.length) return
    setResolving(true)
    try {
      const { token } = await getAuthContext()
      await Promise.all(pendingIds.map((id) => resolveAlert(id, token)))
      setSelected(new Set())
      onRefresh?.()
    } catch { /* silencioso */ } finally { setResolving(false) }
  }

  const busy = marking || resolving

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[hsl(var(--muted)/0.4)] hover:bg-[hsl(var(--muted)/0.7)] transition-colors cursor-pointer select-none"
      >
        <span className="text-[hsl(var(--muted-foreground))]">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', typeCfg.chipCls)}>
          {typeCfg.label}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] flex-1">
          {typeAlerts.length} alerta{typeAlerts.length !== 1 ? 's' : ''}
          {!isWorker && pendingIds.length > 0 && ` · ${pendingIds.length} pendiente${pendingIds.length !== 1 ? 's' : ''}`}
        </span>
        {!isWorker && typeCfg.route && (
          <button type="button" onClick={handlePedidos} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white transition-colors shadow-sm">
            <ShoppingCart size={12} />
            {marking ? 'Marcando…' : 'Pedidos'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Barra de acciones batch — solo si hay pendientes y no es trabajador */}
          {showResolve && pendingIds.length > 0 && !isWorker && (
            <div className="flex items-center gap-2 flex-wrap pb-1 border-b border-[hsl(var(--border)/0.5)]">
              <button type="button" onClick={selectAll} disabled={busy}
                className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
                Seleccionar todas ({pendingIds.length})
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-[hsl(var(--border))]">·</span>
                  <button type="button" onClick={clearAll} disabled={busy}
                    className="text-[11px] text-[hsl(var(--muted-foreground))] hover:underline disabled:opacity-50">
                    Limpiar
                  </button>
                  <button type="button" onClick={handleResolveSelected} disabled={busy}
                    className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors shadow-sm">
                    {resolving ? 'Resolviendo…' : `Resolver seleccionadas (${selected.size})`}
                  </button>
                </>
              )}
              {selected.size === 0 && (
                <button type="button" onClick={handleResolveAll} disabled={busy}
                  className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors shadow-sm">
                  {resolving ? 'Resolviendo…' : `Resolver todas (${pendingIds.length})`}
                </button>
              )}
            </div>
          )}

          {/* Alertas agrupadas por día */}
          {[...byDay.entries()].map(([dayLabel, dayAlerts]) => (
            <div key={dayLabel} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  {dayLabel}
                </span>
                <div className="flex-1 h-px bg-[hsl(var(--border))]" />
              </div>
              {dayAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  isWorker={isWorker}
                  alert={alert}
                  isSelected={selected.has(alert.id)}
                  onToggleSelect={showResolve && alert.status === 'pending' ? toggleSelect : null}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AlertTrendChart({ alerts }) {
  const data = useMemo(() => {
    const days = 14
    const result = []
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today)
      day.setDate(today.getDate() - i)
      day.setHours(23, 59, 59, 999)
      const label  = day.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      const dayEnd = day.getTime()

      // Pendientes acumuladas al final de ese día: creadas hasta ese día y aún pendientes
      const pendientes = alerts.filter((a) => {
        const t = new Date(a.created_at).getTime()
        return t <= dayEnd && a.status === 'pending'
      }).length

      // Resueltas acumuladas: creadas hasta ese día y ya resueltas
      const resueltas = alerts.filter((a) => {
        const t = new Date(a.created_at).getTime()
        return t <= dayEnd && a.status === 'resolved'
      }).length

      result.push({ fecha: label, Pendientes: pendientes, Resueltas: resueltas })
    }
    return result
  }, [alerts])

  const hasData = data.some((d) => d.Pendientes > 0 || d.Resueltas > 0)
  if (!hasData) return null

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 pt-4 pb-2">
      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
        Tendencia acumulada — últimos 14 días
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Pendientes"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Resueltas"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function AlertasContent({ localId }) {
  const { alerts, loading, error, pendingCount, refresh } = useAlerts(localId)
  const { userRole } = useAuth()
  const isWorker = WORKER_ROLES.includes(userRole)
  const [filter, setFilter] = useState('pending')

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const alert of filtered) {
      const key = alert.type || 'manual'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(alert)
    }
    return map
  }, [filtered])

  if (loading) return <SectionState loading={true} error={null} isEmpty={false} emptyMessage="" />
  if (error)   return <SectionState loading={false} error={error} isEmpty={false} emptyMessage="" />

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Alertas Pendientes" value={pendingCount}                                         sub="Requieren atención" accent="warning" />
        <KpiCard label="Resueltas"          value={alerts.filter((a) => a.status === 'resolved').length} sub="Total historial" />
        <KpiCard label="Total Historial"    value={alerts.length}                                        sub="Todas las alertas" accent="blue" />
      </div>

      {/* Filtros */}
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

      {/* Gráfico tendencia */}
      <AlertTrendChart alerts={alerts} />

      {/* Grupos acordeón */}
      {filtered.length === 0 ? (
        <Panel title="Alertas" sub="Se actualiza automáticamente al detectar cambios en inventario">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {filter === 'pending' ? 'No hay alertas pendientes. El sistema está operando con normalidad.' : 'No hay alertas en este filtro.'}
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()]
            .sort(([, aArr], [, bArr]) => {
              const minSev = (arr) => Math.min(...arr.map((a) => SEVERITY_ORDER[a.severity] ?? 99))
              return minSev(aArr) - minSev(bArr)
            })
            .map(([type, typeAlerts]) => (
              <AlertGroup key={type} type={type} typeAlerts={typeAlerts} localId={localId} onRefresh={refresh} isWorker={isWorker} />
            ))}
        </div>
      )}
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
          className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
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

// ── Configuración ─────────────────────────────────────────

function ConfiguracionContent({ localId }) {
  const [posList, setPosList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ mp_pos_id: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    getAuthContext().then(({ token }) =>
      apiRequest(`/webhooks/mercadopago-pos?local_id=${localId}`, { token })
        .then((data) => setPosList(Array.isArray(data) ? data : []))
        .catch(() => setError('Error cargando dispositivos POS'))
        .finally(() => setLoading(false))
    )
  }, [localId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.mp_pos_id.trim()) return setError('El ID del POS es requerido')
    setSaving(true)
    setError('')
    try {
      const { token } = await getAuthContext()
      const newPos = await apiRequest('/webhooks/mercadopago-pos', {
        method: 'POST',
        token,
        body: { mp_pos_id: form.mp_pos_id.trim(), local_id: localId, name: form.name.trim() || null },
      })
      setPosList((prev) => [...prev, newPos])
      setForm({ mp_pos_id: '', name: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const { token } = await getAuthContext()
      await apiRequest(`/webhooks/mercadopago-pos/${id}`, { method: 'DELETE', token })
      setPosList((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Error eliminando dispositivo')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <section className="border border-[hsl(var(--border))] rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
          Dispositivos POS MercadoPago
        </h3>

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        ) : posList.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center border border-dashed rounded-md">
            No hay dispositivos POS registrados
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">ID del POS</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nombre</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {posList.map((pos) => (
                  <tr key={pos.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{pos.mp_pos_id}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{pos.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pos.id)}
                        className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]">
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label className="text-xs text-muted-foreground">ID del POS *</label>
            <input
              type="text"
              placeholder="ej: PAX_A920_001"
              value={form.mp_pos_id}
              onChange={(e) => setForm((p) => ({ ...p, mp_pos_id: e.target.value }))}
              className="h-9 rounded-md border border-[hsl(var(--border))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label className="text-xs text-muted-foreground">Nombre (opcional)</label>
            <input
              type="text"
              placeholder="ej: Caja 1"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 rounded-md border border-[hsl(var(--border))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Agregando...' : 'Agregar POS'}
          </Button>
        </form>

        {error && <p className="mt-2 text-xs text-[hsl(var(--destructive))]">{error}</p>}
      </section>
    </div>
  )
}

// ── Modal Nuevo Gasto ──────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'agua',        label: 'Agua'          },
  { value: 'luz',         label: 'Luz'           },
  { value: 'gas',         label: 'Gas'           },
  { value: 'internet',    label: 'Internet'      },
  { value: 'supplies',    label: 'Insumos'       },
  { value: 'maintenance', label: 'Mantención'    },
  { value: 'staff',       label: 'Personal'      },
  { value: 'other',       label: 'Otros'         },
]

const EXPENSE_LABEL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))

function NuevoGastoModal({ localId, onClose, onSaved }) {
  const [category,    setCategory]    = useState('other')
  const [amount,      setAmount]      = useState('')
  const [description, setDescription] = useState('')
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')
  const [visible,     setVisible]     = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    if (saving) return
    setVisible(false)
    setTimeout(onClose, 300)
  }

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
      handleClose()
    } catch (e) { setErr(e?.message || 'Error al guardar'); setSaving(false) }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10">
              <TrendingDown size={18} className="text-rose-500" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nuevo Gasto</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Registrar salida de dinero</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls + ' cursor-pointer'}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Monto (CLP)</label>
                <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Fecha</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Descripción <span className="normal-case font-normal opacity-50">(opcional)</span></label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle del gasto" className={inputCls} />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={handleClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Modal Reportar Transferencia ───────────────────────────

function ReportarTransferenciaModal({ localId, onClose, onSaved }) {
  const [amount,      setAmount]      = useState('')
  const [file,        setFile]        = useState(null)
  const [preview,     setPreview]     = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')
  const [visible,     setVisible]     = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setErr('La imagen no puede superar 5 MB'); return }
    setFile(f)
    setErr('')
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { setErr('Ingresa un monto válido'); return }
    setSaving(true); setErr('')
    let receiptUrl = null
    try {
      if (file) {
        setUploading(true)
        receiptUrl = await uploadReceipt(file, { localId })
        setUploading(false)
      }
      await postTransfer({ local_id: localId, amount: amt, receipt_url: receiptUrl })
      onSaved()
      onClose()
    } catch (e2) { setErr(e2?.message || 'Error al guardar'); setSaving(false); setUploading(false) }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider'
  const busy = saving || uploading

  const handleClose = () => {
    if (busy) return
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Send size={16} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Reportar Transferencia</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Respaldo documental de envío de fondos</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Monto (CLP)</label>
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} required disabled={busy} />
            </div>

            {/* Zona de carga de imagen */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>
                Foto / Comprobante <span className="normal-case font-normal opacity-50">(opcional)</span>
              </label>
              <label className={cn(
                'relative flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all',
                busy
                  ? 'opacity-50 pointer-events-none border-[hsl(var(--border))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--muted)/0.5)]'
              )}>
                <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={busy} />
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-36 rounded-lg object-contain shadow-md" />
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
                      {uploading
                        ? <Upload size={18} className="text-[hsl(var(--primary))] animate-bounce" />
                        : <ImageIcon size={18} className="text-[hsl(var(--muted-foreground))]" />
                      }
                    </span>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center leading-relaxed">
                      {uploading ? 'Subiendo imagen…' : 'Haz clic o arrastra una imagen'}
                      <br />
                      <span className="opacity-50">JPG, PNG, WEBP · máx. 5 MB</span>
                    </p>
                  </>
                )}
              </label>
              {file && !preview && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{file.name}</p>
              )}
              {file && preview && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{file.name}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={handleClose} disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button type="submit" disabled={busy}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-all disabled:opacity-50">
                {uploading ? 'Subiendo…' : saving ? 'Guardando…' : 'Reportar transferencia'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Modal Nueva Caja ────────────────────────────────────────

function NuevaCajaModal({ localId, onClose, onSaved }) {
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    if (saving) return
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setErr('Ingresa un nombre para la caja'); return }
    setSaving(true); setErr('')
    try {
      await createCaja({ local_id: localId, name: name.trim(), is_active: true })
      onSaved()
      handleClose()
    } catch (e) { setErr(e?.message || 'Error al guardar'); setSaving(false) }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <CreditCard size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nueva Caja</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Crear una caja para este local</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja 1" className={inputCls} required autoFocus />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={handleClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Crear caja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const MOVIMIENTO_SOURCE_LABEL = {
  dine_in: 'Mesa',
  takeout: 'Para llevar',
  mostrador: 'Mostrador',
  delivery: 'Delivery',
  haulmer_pos: 'Haulmer POS',
  mercadopago_pos: 'Mercado Pago',
}

function CajaMovimientosModal({ caja, onClose }) {
  const [resumen, setResumen] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true); setErr('')
      try {
        const [resumenData, movimientosData] = await Promise.all([
          getCajaResumen(caja.id),
          getMovimientosCaja(caja.id),
        ])
        if (!ignore) { setResumen(resumenData); setMovimientos(movimientosData) }
      } catch (e) {
        if (!ignore) setErr(e?.message || 'No se pudo cargar el movimiento de la caja')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [caja.id])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <ArrowLeftRight size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Movimientos de Caja</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{caja.name || 'Caja sin nombre'}</p>
            </div>
          </div>
          <button onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 flex-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          {loading ? (
            <LoadingSpinner message="Cargando movimientos..." />
          ) : (
            <>
              {resumen && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Apertura</p>
                    <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumen.monto_apertura))}</p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Ingresos</p>
                    <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumen.total_ingresos))}</p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total esperado</p>
                    <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumen.total_esperado))}</p>
                  </div>
                </div>
              )}

              {resumen && resumen.por_metodo.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Desglose por método de pago</h3>
                  <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">Para arquear, compara el monto de Mercado Pago aquí contra el reporte de la app/sitio de Mercado Pago.</p>
                  <div className="flex flex-col gap-1.5">
                    {resumen.por_metodo.map((row) => (
                      <div key={row.source} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <span className="text-[hsl(var(--foreground))]">{MOVIMIENTO_SOURCE_LABEL[row.source] || row.source}</span>
                        <span className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(Number(row.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Movimientos</h3>
                {movimientos.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Todavía no hay movimientos registrados en esta caja.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {movimientos.map((mov) => (
                      <RowCard
                        key={mov.id}
                        title={formatMoney(Number(mov.monto))}
                        sub={formatDateTime(mov.created_at)}
                        meta={mov.order_id ? `Orden ${String(mov.order_id).slice(0, 8)}` : null}
                        pill={MOVIMIENTO_SOURCE_LABEL[mov.payment_source] || mov.payment_source || mov.tipo}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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
      return <RendicionesContent rendiciones={payload.rendiciones} expenses={payload.expenses} transfers={payload.transfers} loading={payload.loading} error={payload.error} onRefresh={payload.onRefresh} />
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
      return <FlujoCajaContent dashboard={{ ...flujoDashboard, expenses_breakdown: flujoExpenseData }} cajas={payload.cajas} loading={payload.loading} error={payload.error} onManagePairing={payload.onManagePairing} onViewMovimientos={payload.onViewMovimientos} />
    }
    case 'alertas':
      return <AlertasContent localId={payload.localId} />
    case 'bonos':
      return <BonosContent dashboard={payload.dashboard} loading={payload.loading} error={payload.error} localId={payload.localId} onRefresh={payload.onRefresh} />
    case 'configuracion':
      return <ConfiguracionContent localId={payload.localId} />
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
  const [showNuevaCaja, setShowNuevaCaja]               = useState(false)
  const [pairingCaja, setPairingCaja]                   = useState(null)
  const [movimientosCaja, setMovimientosCaja]           = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [guideOpen,  setGuideOpen]  = useState(false)

  const selectedLocalFromHook = useSelectedLocal(localId, 'state-then-locales')
  const [fetchedLocal, setFetchedLocal] = useState(null)

  useEffect(() => {
    if (!localId) return
    getLocalById(localId)
      .then((data) => { if (data?.id) setFetchedLocal(data) })
      .catch(() => {})
  }, [localId])

  const selectedLocal = selectedLocalFromHook ?? fetchedLocal

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
          const [consolidated, orders, expenses] = await Promise.all([
            getConsolidatedDashboard(businessId, token, { localId }),
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
      {showNuevaCaja && (
        <NuevaCajaModal
          localId={localId}
          onClose={() => setShowNuevaCaja(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {isV2FeatureEnabled('cajaMpPairing') && pairingCaja && (
        <CajaMpPairingModal
          caja={pairingCaja}
          localId={localId}
          onClose={() => setPairingCaja(null)}
          onUpdated={() => setRefreshKey(k => k + 1)}
        />
      )}
      {movimientosCaja && (
        <CajaMovimientosModal
          caja={movimientosCaja}
          onClose={() => setMovimientosCaja(null)}
        />
      )}
      <AnimatePresence>
        {guideOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setGuideOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Módulo Administrativo</h3>
                </div>
                <button onClick={() => setGuideOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { icon: LayoutDashboard, color: 'text-[hsl(var(--primary))]', title: 'Dashboard', desc: 'Resumen general del local: ventas totales, gastos, pedidos y estado financiero del día.' },
                  { icon: ShoppingCart, color: 'text-emerald-600', title: 'Ventas', desc: 'Detalle de todos los pedidos del día con desglose por método de pago, productos y montos.' },
                  { icon: ArrowLeftRight, color: 'text-blue-600', title: 'Rendiciones', desc: 'Registro de transferencias del dueño al local y de gastos operativos. Permite reportar nuevas transferencias y gastos.' },
                  { icon: BarChart2, color: 'text-violet-600', title: 'Reportes', desc: 'Comparativas de ventas, flujo de caja y análisis por período. Útil para tomar decisiones basadas en datos históricos.' },
                  { icon: CreditCard, color: 'text-amber-600', title: 'Caja Virtual', desc: 'Resumen monetario del período: ingresos, egresos y saldo disponible por caja registradora.' },
                  { icon: Bell, color: 'text-red-600', title: 'Alertas', desc: 'Notificaciones del sistema sobre situaciones que requieren atención: stock bajo, pedidos pendientes, etc.' },
                  { icon: Award, color: 'text-[hsl(var(--primary))]', title: 'Bonos', highlight: true, desc: 'Registro de bonos por metas cumplidas. Muestra el estado de cada objetivo y los bonos asignados al equipo.' },
                ].map(({ icon: Icon, color, title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={15} /></div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="flex-1 overflow-y-auto no-scrollbar px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[hsl(var(--primary))] tracking-tight">
              {activeSectionMeta.label}
            </h2>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{activeSectionMeta.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SectionActions
              activeSection={activeSection}
              onNuevoGasto={() => setShowNuevoGasto(true)}
              onNuevaTransferencia={() => setShowNuevaTransferencia(true)}
              onNuevaCaja={() => setShowNuevaCaja(true)}
            />
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={13} />
              <span>¿Cómo funciona este módulo?</span>
            </button>
          </div>
        </div>

        {renderSectionContent(activeSection, {
          ...sectionData,
          loading,
          error:    sectionError,
          localId,
          onRefresh: () => setRefreshKey(k => k + 1),
          onManagePairing: isV2FeatureEnabled('cajaMpPairing') ? setPairingCaja : undefined,
          onViewMovimientos: isV2FeatureEnabled('movimientosCaja') ? setMovimientosCaja : undefined,
        })}
      </main>
    </>
  )
}

export default AdministrativeModule
