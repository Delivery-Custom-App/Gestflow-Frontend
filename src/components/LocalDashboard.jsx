import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { m, AnimatePresence } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../lib/formatCLP'
import { getInventoryKpisByLocal } from '../lib/inventoryApi'
import { getLocalDashboard, getOrdersByLocal, getIncomeTrend } from '../lib/administrativeApi'
import { getAuthContext } from '../lib/apiClient'
import { generateIncomeTrendFromOrders } from '../utils/chartDataHelpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from './PageTransition'
import LoadingSpinner from './LoadingSpinner'
import ChartSkeleton from './ui/ChartSkeleton'
import IncomeChart from './charts/IncomeChart'
// recharts ya se carga bajo demanda: este modulo solo se importa desde paginas con React.lazy
// (AuthenticatedRoutes) y el build lo deja en un chunk aparte, fuera del bundle inicial.
// oxlint-disable-next-line react-doctor/prefer-dynamic-import
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  PieChart, Pie, LabelList, LineChart, Line, Legend,
} from 'recharts'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  TrendingUp, Wallet, Clock, CreditCard, X, BarChart2, HelpCircle,
  LineChart as LineChartIcon, PieChart as PieChartIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPaymentPct, paymentMethodLabel, CHILE_TZ, parseApiDate,
} from '../utils/chileDateTime'

const PIE_COLORS = ['#3BBF7A', '#F2A623', '#E8394A']
const PAY_CHART_COLORS = ['var(--chart-cat-1)', 'var(--chart-cat-2)', 'var(--chart-cat-3)', 'var(--chart-cat-4)', 'var(--chart-cat-5)']

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

/** Agrupa método de pago en efectivo | mercadopago | null. */
function paymentMethodBucket(method) {
  const key = String(method || '').trim().toLowerCase()
  if (key === 'mercadopago' || key.startsWith('mercadopago_point')) return 'mercadopago'
  if (key === 'cash' || key === 'efectivo') return 'efectivo'
  return null
}

function KpiCard({ icon: Icon, label, value, iconColor, iconBg, accentColor, loading }) {
  return (
    <Card className={`border-l-4 ${accentColor} overflow-hidden h-full`}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg} ${iconColor}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-tight">{label}</p>
          {loading
            ? <div className="h-7 w-16 bg-[hsl(var(--muted))] rounded animate-pulse mt-0.5" />
            : <p className={`text-2xl font-bold leading-tight mt-0.5 ${iconColor}`}>{value}</p>
          }
        </div>
      </CardContent>
    </Card>
  )
}

/* ── LocalDashboard ───────────────────────────────────────────── */
function LocalDashboard() {
  const { localId } = useParams()

  const [trendRange, setTrendRange]       = useState('7d')
  const [trendData, setTrendData]         = useState(null)
  const [trendLoading, setTrendLoading]   = useState(false)
  const [invKpis, setInvKpis]             = useState(null)
  const [invLoading, setInvLoading]       = useState(true)
  const [dashboard, setDashboard]         = useState(null)
  const [dashLoading, setDashLoading]     = useState(true)
  const [orders, setOrders]               = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [payChartView, setPayChartView]   = useState('line')
  const [ordersRefreshTick, setOrdersRefreshTick] = useState(0)
  const [guideOpen, setGuideOpen]         = useState(false)

  useEffect(() => {
    if (!localId) return
    let ignore = false

    setInvLoading(true)
    getInventoryKpisByLocal(localId)
      .then((data) => { if (!ignore) setInvKpis(data) })
      .catch(() => { if (!ignore) setInvKpis(null) })
      .finally(() => { if (!ignore) setInvLoading(false) })

    setDashLoading(true)
    setOrdersLoading(true)
    getAuthContext()
      .then(({ token }) => Promise.all([
        getLocalDashboard(localId, token),
        getOrdersByLocal(localId, token),
      ]))
      .then(([dash, ords]) => {
        if (!ignore) {
          setDashboard(dash)
          setOrders(Array.isArray(ords) ? ords : [])
        }
      })
      .catch(() => { if (!ignore) { setDashboard(null); setOrders([]) } })
      .finally(() => { if (!ignore) { setDashLoading(false); setOrdersLoading(false) } })

    return () => { ignore = true }
  }, [localId])

  useEffect(() => {
    const interval = setInterval(() => setOrdersRefreshTick((t) => t + 1), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!localId || ordersRefreshTick === 0) return
    let ignore = false
    setOrdersLoading(true)
    getAuthContext()
      .then(({ token }) => getOrdersByLocal(localId, token))
      .then((ords) => { if (!ignore) setOrders(Array.isArray(ords) ? ords : []) })
      .catch(() => {})
      .finally(() => { if (!ignore) setOrdersLoading(false) })
    return () => { ignore = true }
  }, [localId, ordersRefreshTick])

  useEffect(() => {
    if (!localId) return
    let ignore = false
    setTrendLoading(true)
    getAuthContext()
      .then(({ token }) => getIncomeTrend(localId, token, 7))
      .then((data) => { if (!ignore) setTrendData(Array.isArray(data) ? data : null) })
      .catch(() => { if (!ignore) setTrendData(null) })
      .finally(() => { if (!ignore) setTrendLoading(false) })
    return () => { ignore = true }
  }, [localId])

  const incomeTrend = useMemo(() => {
    if (trendRange === '7d') return trendData ?? []
    return generateIncomeTrendFromOrders(orders, trendRange)
  }, [orders, trendRange, trendData])

  const pieData = useMemo(() => {
    if (!invKpis) return []
    return [
      { name: 'Óptimo',     value: invKpis.optimal_stock_count  ?? 0 },
      { name: 'Stock bajo', value: invKpis.low_stock_count      ?? 0 },
      { name: 'Crítico',    value: invKpis.critical_stock_count ?? 0 },
    ].filter((d) => d.value > 0)
  }, [invKpis])

  /** Monto recaudado por método de pago (CLP). */
  const payAmountData = useMemo(() => {
    const rows = dashboard?.payment_breakdown
    if (!Array.isArray(rows) || !rows.length) return []
    const totalAmount = rows.reduce((s, p) => s + Number(p.total ?? 0), 0)
    return rows.map((p, i) => ({
      name:  paymentMethodLabel(p.method),
      monto: Number(p.total ?? 0),
      color: PAY_CHART_COLORS[i % PAY_CHART_COLORS.length],
      pct:   totalAmount > 0 ? (Number(p.total ?? 0) / totalAmount * 100) : 0,
    }))
  }, [dashboard?.payment_breakdown])

  /** Cantidad de ventas por método de pago. */
  const payCountData = useMemo(() => {
    const rows = dashboard?.payment_breakdown
    if (!Array.isArray(rows) || !rows.length) return []
    const totalCount = rows.reduce((s, p) => s + Number(p.count ?? 0), 0)
    return rows.map((p, i) => ({
      name:  paymentMethodLabel(p.method),
      ventas: Number(p.count ?? 0),
      color: PAY_CHART_COLORS[i % PAY_CHART_COLORS.length],
      pct:   totalCount > 0 ? (Number(p.count ?? 0) / totalCount * 100) : 0,
    }))
  }, [dashboard?.payment_breakdown])

  /** Monto por día: evolución temporal Efectivo vs MercadoPago (eje X = fechas). */
  const payAmountTimeSeries = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const buckets = new Map()

    for (const o of orders) {
      if (String(o.status || '').toLowerCase() !== 'completed') continue
      const d = parseApiDate(o.created_at)
      if (!d || d < monthStart) continue

      const sortKey = d.toLocaleDateString('en-CA', { timeZone: CHILE_TZ })
      const label = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', timeZone: CHILE_TZ })
      const bucket = paymentMethodBucket(o.payment_method)
      if (!bucket) continue

      if (!buckets.has(sortKey)) {
        buckets.set(sortKey, { label, sortKey, efectivo: 0, mercadopago: 0 })
      }
      const row = buckets.get(sortKey)
      row[bucket] += Number(o.total ?? 0)
    }

    return Array.from(buckets.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [orders])

  const finCards = [
    { icon: TrendingUp, label: 'Ventas Hoy',      value: formatMoney(dashboard?.daily_sales),        iconColor: 'text-[hsl(var(--success))]', iconBg: 'bg-[hsl(var(--success)/0.12)]', accentColor: 'border-l-[hsl(var(--success))]' },
    { icon: DollarSign, label: 'Ventas del Mes',   value: formatMoney(dashboard?.monthly_sales),     iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-[hsl(var(--primary)/0.12)]', accentColor: 'border-l-[hsl(var(--primary))]' },
    { icon: Wallet,     label: 'Caja Virtual',     value: formatMoney(dashboard?.monthly_cash_flow), iconColor: 'text-[hsl(var(--info-foreground))]', iconBg: 'bg-[hsl(var(--info))]', accentColor: 'border-l-[hsl(var(--info-foreground))]' },
    { icon: DollarSign, label: 'Ticket Promedio',  value: formatMoney(dashboard?.avg_ticket ?? 0),   iconColor: 'text-[hsl(var(--info-foreground))]', iconBg: 'bg-[hsl(var(--info))]', accentColor: 'border-l-[hsl(var(--info-foreground))]' },
  ]

  const invCards = [
    { icon: Package,       label: 'Total productos',  value: invKpis?.total_products       ?? '—', iconColor: 'text-[hsl(var(--info-foreground))]', iconBg: 'bg-[hsl(var(--info))]', accentColor: 'border-l-[hsl(var(--info-foreground))]' },
    { icon: CheckCircle,   label: 'Stock óptimo',     value: invKpis?.optimal_stock_count  ?? '—', iconColor: 'text-[hsl(var(--success))]', iconBg: 'bg-[hsl(var(--success)/0.12)]', accentColor: 'border-l-[hsl(var(--success))]' },
    { icon: TrendingDown,  label: 'Stock bajo',       value: invKpis?.low_stock_count      ?? '—', iconColor: 'text-[hsl(var(--warning-foreground))]', iconBg: 'bg-[hsl(var(--warning)/0.15)]', accentColor: 'border-l-[hsl(var(--warning))]' },
    { icon: AlertTriangle, label: 'Stock crítico',    value: invKpis?.critical_stock_count ?? '—', iconColor: 'text-[hsl(var(--destructive))]', iconBg: 'bg-[hsl(var(--destructive)/0.1)]', accentColor: 'border-l-[hsl(var(--destructive))]' },
    { icon: DollarSign,    label: 'Valor total inv.', value: formatMoney(invKpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-[hsl(var(--primary)/0.12)]', accentColor: 'border-l-[hsl(var(--primary))]' },
  ]

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <PageTransition className="flex flex-col gap-6 p-3 sm:p-6 pb-10">

          {/* Botón de ayuda flotante */}
          <div className="flex justify-end -mb-3">
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={14} />
              <span>¿Cómo leer este dashboard?</span>
            </button>
          </div>

          {/* Panel guía del dashboard */}
          <AnimatePresence>
            {guideOpen && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                onClick={() => setGuideOpen(false)}
              >
                <m.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                      <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía del Dashboard</h3>
                    </div>
                    <button type="button" aria-label="Cerrar guía"
                      onClick={() => setGuideOpen(false)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {[
                      {
                        title: 'Resumen Financiero',
                        icon: DollarSign,
                        color: 'text-emerald-600',
                        desc: 'Muestra las ventas del día, ventas del mes, caja virtual, ticket promedio, tasa de cancelaciones y la hora de mayor actividad del local.',
                      },
                      {
                        title: 'Inventario',
                        icon: Package,
                        color: 'text-blue-600',
                        desc: 'Estado del stock: total de productos, cuántos están en nivel óptimo, bajo o crítico, y el valor total del inventario disponible.',
                      },
                      {
                        title: 'Tendencia de Ingresos',
                        icon: BarChart2,
                        color: 'text-violet-600',
                        desc: 'Gráfico de evolución de ingresos por período (7 días, 30 días o 3 meses). Permite detectar tendencias de crecimiento o caída.',
                      },
                      {
                        title: 'Distribución de Pedidos',
                        icon: CheckCircle,
                        color: 'text-amber-600',
                        desc: 'Proporción de pedidos por estado: completados, pendientes y cancelados. Indica la eficiencia operativa del local.',
                      },
                      {
                        title: 'Actividad por Hora',
                        icon: Clock,
                        color: 'text-pink-600',
                        desc: 'Muestra la cantidad de pedidos en cada hora del día para identificar los momentos de mayor y menor demanda.',
                      },
                    ].map(({ title, icon: Icon, color, desc, highlight }) => (
                      <div
                        key={title}
                        className={cn(
                          'flex gap-3 rounded-xl p-3',
                          highlight
                            ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]'
                            : 'bg-[hsl(var(--muted)/0.4)]',
                        )}
                      >
                        <div className={cn('mt-0.5 shrink-0', color)}>
                          <Icon size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Resumen Financiero */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen Financiero</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Actividad del local</p>
              </div>
            </div>
            <m.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {finCards.map((k, idx) => (
                <m.div key={k.label} variants={ITEM} data-onboarding={idx === 0 ? 'dashboard-ventas-card' : undefined}>
                  <KpiCard {...k} loading={dashLoading} />
                </m.div>
              ))}
            </m.div>
          </section>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Tendencia de Ingresos</CardTitle>
                  <div className="flex items-center gap-1">
                    {['1h','4h','12h','1d','7d'].map((key) => (
                      <button
                        key={key}
                        onClick={() => setTrendRange(key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          trendRange === key
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(trendRange === '7d' ? trendLoading : ordersLoading) ? (
                  <ChartSkeleton className="h-[220px]" />
                ) : incomeTrend.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">Sin pedidos registrados en el período.</p>
                ) : (
                  <IncomeChart data={incomeTrend} showCashFlow={trendRange === '7d'} />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Estado de Stock</CardTitle>
              </CardHeader>
              <CardContent>
                {invLoading ? (
                  <ChartSkeleton className="h-[180px]" />
                ) : pieData.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">Sin datos de inventario.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={pieData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} width={28} />
                      <Tooltip
                        formatter={(v, n) => [`${v} productos`, n]}
                        cursor={{ fill: 'hsl(var(--accent))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {pieData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        <LabelList
                          dataKey="value"
                          position="top"
                          fontSize={12}
                          fontWeight={700}
                          fill="hsl(var(--foreground))"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparativo semanal + distribución por pago */}
          {dashLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativo Semanal</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana vs semana anterior</p>
                </CardHeader>
                <CardContent><ChartSkeleton className="h-[140px]" /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard size={15} /> Distribución por Pago</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Métodos de pago este mes</p>
                </CardHeader>
                <CardContent><ChartSkeleton className="h-[170px]" /></CardContent>
              </Card>
            </div>
          ) : dashboard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativo Semanal</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana vs semana anterior</p>
                </CardHeader>
                <CardContent>
                  {dashboard.week_comparison ? (() => {
                    const wc  = dashboard.week_comparison
                    const pct = Number(wc.change_pct ?? 0)
                    const isUp = pct >= 0
                    return (
                      <div className="space-y-3">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana</p>
                            <p className="text-2xl font-extrabold text-[hsl(var(--foreground))]">{formatMoney(wc.current_week_sales)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Semana anterior</p>
                            <p className="text-lg font-bold text-[hsl(var(--muted-foreground))]">{formatMoney(wc.prev_week_sales)}</p>
                          </div>
                        </div>
                        <div className={`rounded-lg px-3 py-2 text-sm font-semibold text-center ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct.toFixed(1)}% vs semana anterior
                        </div>
                      </div>
                    )
                  })() : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">Sin datos suficientes aún.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2"><CreditCard size={15} /> Distribución por Pago</CardTitle>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {payChartView === 'line'
                          ? 'Evolución diaria del monto recaudado (Efectivo y MercadoPago)'
                          : 'Cantidad de ventas por método este mes'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPayChartView('line')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                          payChartView === 'line'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                        )}
                      >
                        <LineChartIcon size={13} />
                        Por monto
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayChartView('pie')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                          payChartView === 'pie'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                        )}
                      >
                        <PieChartIcon size={13} />
                        Por cantidad
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(payChartView === 'line' ? payAmountTimeSeries.length > 0 : payCountData.length > 0) ? (
                    <div className="flex flex-col items-center gap-3">
                      <ResponsiveContainer width="100%" height={170}>
                        {payChartView === 'line' ? (
                          <LineChart data={payAmountTimeSeries} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              axisLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              axisLine={false}
                              width={40}
                            />
                            <Tooltip
                              formatter={(v, name) => [
                                formatMoney(v),
                                name === 'efectivo' ? 'Efectivo' : name === 'mercadopago' ? 'MercadoPago' : name,
                              ]}
                              labelFormatter={(label) => `Día ${label}`}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                              formatter={(value) => (value === 'efectivo' ? 'Efectivo' : 'MercadoPago')}
                            />
                            <Line
                              type="monotone"
                              dataKey="efectivo"
                              name="efectivo"
                              stroke="#16a34a"
                              className="chart-brand-stroke"
                              strokeWidth={2}
                              dot={{ r: 3, className: 'chart-brand-fill', fill: '#16a34a' }}
                              activeDot={{ r: 5 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="mercadopago"
                              name="mercadopago"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#3b82f6' }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        ) : (
                          <PieChart>
                            <Pie
                              data={payCountData}
                              cx="50%"
                              cy="50%"
                              innerRadius={46}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="ventas"
                            >
                              {payCountData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v, n, props) => {
                                const pct = props?.payload?.pct
                                return [`${v} venta${v === 1 ? '' : 's'} (${formatPaymentPct(pct)})`, n]
                              }}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                            />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        {payChartView === 'line' ? (
                          payAmountData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {entry.name}{' '}
                                <span className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(entry.monto)}</span>
                                <span className="text-[hsl(var(--muted-foreground))]"> ({formatPaymentPct(entry.pct)} del mes)</span>
                              </span>
                            </div>
                          ))
                        ) : (
                          payCountData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {entry.name}{' '}
                                <span className="font-semibold text-[hsl(var(--foreground))]">{entry.ventas} venta{entry.ventas === 1 ? '' : 's'}</span>
                                <span className="text-[hsl(var(--muted-foreground))]"> ({formatPaymentPct(entry.pct)})</span>
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">Sin ventas registradas.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resumen de Inventario */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen de Inventario</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Estado actual del stock</p>
            </div>
            {invLoading && !invKpis ? (
              <LoadingSpinner message="Cargando inventario..." />
            ) : (
              <m.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                variants={STAGGER} initial="hidden" animate="visible"
              >
                {invCards.map((k) => (
                  <m.div key={k.label} variants={ITEM}>
                    <KpiCard {...k} loading={invLoading} />
                  </m.div>
                ))}
              </m.div>
            )}
          </section>

        </PageTransition>
      </div>
    </>
  )
}

export default LocalDashboard
