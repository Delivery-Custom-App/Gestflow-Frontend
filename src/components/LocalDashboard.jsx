import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { m, AnimatePresence } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../lib/formatCLP'
import { getInventoryKpisByLocal } from '../lib/inventoryApi'
import { getDashboardSalesReport } from '../lib/administrativeApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from './PageTransition'
import LoadingSpinner from './LoadingSpinner'
import ChartSkeleton from './ui/ChartSkeleton'
import IncomeChart from './charts/IncomeChart'
import TarjetaFondoEmergencia from './TarjetaFondoEmergencia'
import { isV2FeatureEnabled } from '../lib/v2Features'
// recharts ya se carga bajo demanda: este modulo solo se importa desde paginas con React.lazy
// (AuthenticatedRoutes) y el build lo deja en un chunk aparte, fuera del bundle inicial.
// oxlint-disable-next-line react-doctor/prefer-dynamic-import
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  PieChart, Pie, LabelList,
} from 'recharts'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  TrendingUp, CreditCard, X, BarChart2, HelpCircle,
  PieChart as PieChartIcon, LifeBuoy, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPaymentPct, paymentMethodLabel } from '../utils/chileDateTime'

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
  const conFondo = isV2FeatureEnabled('fondoEmergencia')

  const [inventoryState, setInventoryState] = useState({ localId: null, data: null })
  const [salesReportState, setSalesReportState] = useState({ localId: null, refreshTick: -1, data: null, error: false })
  const [payChartView, setPayChartView]   = useState('amount')
  const [salesRefreshTick, setSalesRefreshTick] = useState(0)
  const [guideOpen, setGuideOpen]         = useState(false)

  const invKpis = inventoryState.localId === localId ? inventoryState.data : null
  const invLoading = Boolean(localId) && inventoryState.localId !== localId
  const salesReportMatchesView = salesReportState.localId === localId
    && salesReportState.refreshTick === salesRefreshTick
  const salesReport = salesReportMatchesView ? salesReportState.data : null
  const salesReportError = salesReportMatchesView && salesReportState.error
  const salesReportLoading = Boolean(localId) && !salesReportMatchesView

  useEffect(() => {
    if (!localId) return
    let ignore = false

    getInventoryKpisByLocal(localId)
      .then((data) => { if (!ignore) setInventoryState({ localId, data }) })
      .catch(() => { if (!ignore) setInventoryState({ localId, data: null }) })

    return () => { ignore = true }
  }, [localId])

  useEffect(() => {
    const interval = setInterval(() => setSalesRefreshTick((t) => t + 1), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!localId) return
    let ignore = false
    getDashboardSalesReport(localId)
      .then((data) => {
        if (!ignore) setSalesReportState({ localId, refreshTick: salesRefreshTick, data, error: false })
      })
      .catch(() => {
        if (!ignore) setSalesReportState({ localId, refreshTick: salesRefreshTick, data: null, error: true })
      })
    return () => { ignore = true }
  }, [localId, salesRefreshTick])

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
    const rows = salesReport?.payment_breakdown
    if (!Array.isArray(rows) || !rows.length) return []
    const totalAmount = rows.reduce((s, p) => s + Number(p.total ?? 0), 0)
    return rows.map((p, i) => ({
      name:  paymentMethodLabel(p.method),
      monto: Number(p.total ?? 0),
      color: PAY_CHART_COLORS[i % PAY_CHART_COLORS.length],
      pct:   totalAmount > 0 ? (Number(p.total ?? 0) / totalAmount * 100) : 0,
    }))
  }, [salesReport?.payment_breakdown])

  /** Cantidad de ventas por método de pago. */
  const payCountData = useMemo(() => {
    const rows = salesReport?.payment_breakdown
    if (!Array.isArray(rows) || !rows.length) return []
    const totalCount = rows.reduce((s, p) => s + Number(p.count ?? 0), 0)
    return rows.map((p, i) => ({
      name:  paymentMethodLabel(p.method),
      ventas: Number(p.count ?? 0),
      color: PAY_CHART_COLORS[i % PAY_CHART_COLORS.length],
      pct:   totalCount > 0 ? (Number(p.count ?? 0) / totalCount * 100) : 0,
    }))
  }, [salesReport?.payment_breakdown])

  const finCards = [
    { icon: TrendingUp, label: 'Ventas Hoy', value: salesReport?.daily_sales == null ? '—' : formatMoney(salesReport.daily_sales), iconColor: 'text-[hsl(var(--success))]', iconBg: 'bg-[hsl(var(--success)/0.12)]', accentColor: 'border-l-[hsl(var(--success))]' },
    { icon: DollarSign, label: 'Ventas últimos 7 días', value: salesReport?.total_sales == null ? '—' : formatMoney(salesReport.total_sales), iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-[hsl(var(--primary)/0.12)]', accentColor: 'border-l-[hsl(var(--primary))]' },
    { icon: DollarSign, label: 'Ticket Promedio', value: salesReport?.avg_ticket == null ? '—' : formatMoney(salesReport.avg_ticket), iconColor: 'text-[hsl(var(--info-foreground))]', iconBg: 'bg-[hsl(var(--info))]', accentColor: 'border-l-[hsl(var(--info-foreground))]' },
    { icon: XCircle, label: 'Pedidos cancelados', value: salesReport?.cancelled_orders == null ? '—' : String(salesReport.cancelled_orders), iconColor: 'text-[hsl(var(--destructive))]', iconBg: 'bg-[hsl(var(--destructive)/0.1)]', accentColor: 'border-l-[hsl(var(--destructive))]' },
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
                        desc: 'Muestra las ventas de hoy y de los últimos 7 días, el ticket promedio y los pedidos cancelados.',
                      },
                      {
                        title: 'Inventario',
                        icon: Package,
                        color: 'text-blue-600',
                        desc: 'Estado del stock: total de productos, cuántos están en nivel óptimo, bajo o crítico, y el valor total del inventario disponible.',
                      },
                      {
                        title: 'Ventas por día',
                        icon: BarChart2,
                        color: 'text-violet-600',
                        desc: 'Compara las ventas de cada uno de los últimos 7 días, incluidos los días sin ventas.',
                      },
                      {
                        title: 'Comparativo Semanal',
                        icon: CheckCircle,
                        color: 'text-amber-600',
                        desc: 'Compara las ventas de esta semana con el período anterior y evita mostrar porcentajes cuando no hubo ventas antes.',
                      },
                      {
                        title: 'Distribución por Pago',
                        icon: CreditCard,
                        color: 'text-pink-600',
                        desc: 'Resume el monto y la cantidad de ventas por método de pago durante los últimos 7 días.',
                      },
                      ...(conFondo ? [{
                        title: 'Fondo de emergencia',
                        icon: LifeBuoy,
                        color: 'text-sky-600',
                        desc: 'Plata apartada del local para imprevistos: saldo actual y los últimos aportes y usos con su motivo. Desde la tarjeta se va a Administración para aportar, registrar un uso o ver el historial completo; si el local no tiene fondo, ofrece crearlo.',
                      }] : []),
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
            {salesReportError && <p role="alert" className="mb-3 text-sm text-[hsl(var(--destructive))]">No se pudieron cargar los indicadores de ventas. Inténtalo nuevamente.</p>}
            <m.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {finCards.map((k) => (
                <m.div key={k.label} variants={ITEM}>
                  <KpiCard {...k} loading={salesReportLoading} />
                </m.div>
              ))}
            </m.div>
          </section>

          {conFondo && <TarjetaFondoEmergencia localId={localId} />}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-sm">Ventas por día</CardTitle>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Últimos 7 días, incluido hoy</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {salesReportLoading ? (
                  <ChartSkeleton className="h-[220px]" />
                ) : salesReportError ? (
                  <p className="text-sm text-[hsl(var(--destructive))] py-8 text-center">No se pudo cargar la tendencia de ventas.</p>
                ) : !salesReport?.by_day?.length ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">Sin datos para este período.</p>
                ) : (
                  <IncomeChart data={salesReport.by_day} />
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
          {salesReportLoading ? (
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
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativo Semanal</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana vs semana anterior</p>
                </CardHeader>
                <CardContent>
                  {salesReportError ? (
                    <p role="alert" className="text-sm text-[hsl(var(--destructive))] py-4 text-center">No se pudo cargar la comparación semanal.</p>
                  ) : salesReport?.week_comparison ? (() => {
                    const wc  = salesReport.week_comparison
                    const pct = wc.change_pct
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
                        {pct === null
                          ? <div className="rounded-lg px-3 py-2 text-sm font-semibold text-center bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">Sin ventas en la semana anterior</div>
                          : <div className={`rounded-lg px-3 py-2 text-sm font-semibold text-center ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct.toFixed(1)}% vs semana anterior
                          </div>}
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
                        {payChartView === 'amount'
                          ? 'Monto vendido por método (últimos 7 días)'
                          : 'Cantidad de ventas por método (últimos 7 días)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPayChartView('amount')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                          payChartView === 'amount'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                        )}
                      >
                        <DollarSign size={13} />
                        Por monto
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayChartView('count')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                          payChartView === 'count'
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
                  {salesReportError ? (
                    <p role="alert" className="text-sm text-[hsl(var(--destructive))] py-4 text-center">No se pudo cargar la distribución por método de pago.</p>
                  ) : (payChartView === 'amount' ? payAmountData.length > 0 : payCountData.length > 0) ? (
                    <div className="flex flex-col items-center gap-3">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={payChartView === 'amount' ? payAmountData : payCountData}
                            cx="50%"
                            cy="50%"
                            innerRadius={46}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey={payChartView === 'amount' ? 'monto' : 'ventas'}
                          >
                            {(payChartView === 'amount' ? payAmountData : payCountData).map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, props) => {
                              const pct = props?.payload?.pct
                              const formatted = payChartView === 'amount'
                                ? formatMoney(value)
                                : `${value} venta${value === 1 ? '' : 's'}`
                              return [`${formatted} (${formatPaymentPct(pct)})`, name]
                            }}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        {payChartView === 'amount' ? (
                          payAmountData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {entry.name}{' '}
                                <span className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(entry.monto)}</span>
                                <span className="text-[hsl(var(--muted-foreground))]"> ({formatPaymentPct(entry.pct)})</span>
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
