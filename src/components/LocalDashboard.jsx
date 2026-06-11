import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../lib/formatCLP'
import { formatShortAddress } from '../lib/formatAddress'
import { useLocals } from '../hooks/useLocals'
import { getInventoryKpisByLocal, getLocalById } from '../lib/inventoryApi'
import { getLocalDashboard, getOrdersByLocal, getIncomeTrend } from '../lib/administrativeApi'
import { getAuthContext } from '../lib/apiClient'
import { generateIncomeTrendFromOrders } from '../utils/chartDataHelpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from './PageTransition'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  PieChart, Pie,
} from 'recharts'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  TrendingUp, Wallet, Clock, XCircle, MapPin, CreditCard, X, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444']

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

const STATUS_CFG = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  preparing: { label: 'Preparando', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ready:     { label: 'Listo',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  completed: { label: 'Completado', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

function formatHourAMPM(hour) {
  if (hour === null || hour === undefined) return '—'
  if (hour === 0)  return '12:00 AM'
  if (hour < 12)   return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
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

function DrawerSection({ title, children }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-4 py-2.5 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))]">
        <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{title}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

/* ── Drawer lateral derecho con detalle real por KPI ─────────── */
function KpiDetailDrawer({ open, onClose, dashboard, orders, dashLoading }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true))
    else       setVisible(false)
  }, [open])

  /* Pedidos por hora HOY (excluye cancelados, solo el día actual) */
  const hourlyData = useMemo(() => {
    if (!orders.length) return []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const counts = Array.from({ length: 24 }, (_, h) => ({ hora: h, pedidos: 0 }))
    for (const o of orders) {
      if (!o.created_at) continue
      if (String(o.status || '').toLowerCase() === 'cancelled') continue
      const d = new Date(o.created_at)
      if (d < today) continue
      counts[d.getHours()].pedidos += 1
    }
    return counts
      .filter((d) => d.pedidos > 0)
      .map((d) => ({ ...d, label: formatHourAMPM(d.hora), isPeak: d.hora === dashboard?.peak_hour }))
  }, [orders, dashboard?.peak_hour])

  /* Ventas por hora HOY */
  const salesByHourToday = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const counts = Array.from({ length: 24 }, (_, h) => ({ hora: h, label: formatHourAMPM(h), total: 0 }))
    for (const o of orders) {
      if (!o.created_at || String(o.status || '').toLowerCase() === 'cancelled') continue
      const d = new Date(o.created_at)
      if (d >= today) counts[d.getHours()].total += Number(o.total ?? 0)
    }
    return counts.filter((d) => d.total > 0)
  }, [orders])

  /* Ventas diarias últimos 7 días */
  const salesLast7 = useMemo(() => {
    const result = []
    const now = new Date(); now.setHours(23, 59, 59, 999)
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now); day.setDate(now.getDate() - i); day.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)
      const label = day.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      const total = orders
        .filter((o) => {
          if (!o.created_at || String(o.status || '').toLowerCase() === 'cancelled') return false
          const t = new Date(o.created_at)
          return t >= day && t <= dayEnd
        })
        .reduce((s, o) => s + Number(o.total ?? 0), 0)
      result.push({ label, total })
    }
    return result
  }, [orders])

  /* Top mesas por cantidad de pedidos */
  const topMesas = useMemo(() => {
    const map = {}
    for (const o of orders) {
      if (String(o.status || '').toLowerCase() === 'cancelled') continue
      const key = o.mesa_id ? String(o.mesa_id).slice(0, 6) : 'Sin mesa'
      map[key] = (map[key] || 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mesa, pedidos]) => ({ mesa: `Mesa ${mesa}…`, pedidos }))
  }, [orders])

  /* Distribución de pedidos por estado (este mes) */
  const statusDist = useMemo(() => {
    const now = new Date()
    const map = { pending: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 }
    for (const o of orders) {
      const d = new Date(o.created_at)
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue
      const s = String(o.status || '').toLowerCase()
      if (s in map) map[s] += 1
    }
    const COLORS = { pending: '#f59e0b', preparing: '#3b82f6', ready: '#22c55e', completed: '#64748b', cancelled: '#ef4444' }
    const LABELS = { pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo', completed: 'Completado', cancelled: 'Cancelado' }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: LABELS[k], value: v, fill: COLORS[k] }))
  }, [orders])

  if (!open) return null

  const peakHour = dashboard?.peak_hour

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out overflow-y-auto no-scrollbar',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0 sticky top-0 bg-[hsl(var(--card))] z-10">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-[hsl(var(--primary))]" />
            <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Ver detalles</h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {dashLoading ? <LoadingSpinner message="Cargando..." /> : (
            <>
              {/* 1. Hora Peak */}
              <DrawerSection title="Hora Peak">
                <div className="flex items-center gap-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  <Clock size={18} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-2xl font-extrabold text-amber-600">{formatHourAMPM(peakHour)}</p>
                    {peakHour != null && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{peakHour}:00 – {peakHour + 1}:00 · Hora con más actividad</p>}
                  </div>
                </div>
                {hourlyData.length > 0 ? (
                  <>
                    <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Pedidos por hora (AM / PM)</p>
                    <ResponsiveContainer width="100%" height={175}>
                      <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={0} angle={-40} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => [`${v} pedidos`]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="pedidos" radius={[3, 3, 0, 0]} maxBarSize={32}>
                          {hourlyData.map((e, i) => <Cell key={i} fill={e.isPeak ? '#f59e0b' : '#d1d5db'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 justify-center mt-1">
                      <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />Hora peak</span>
                      <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-300" />Otras horas</span>
                    </div>
                  </>
                ) : <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">Sin datos de pedidos.</p>}
              </DrawerSection>

              {/* 2. Ventas hoy por hora */}
              <DrawerSection title="Ventas de hoy por hora">
                {salesByHourToday.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={salesByHourToday} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end" height={40} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip formatter={(v) => [formatMoney(v), 'Ventas']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="total" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">Sin ventas hoy aún.</p>}
              </DrawerSection>

              {/* 3. Tendencia últimos 7 días */}
              <DrawerSection title="Tendencia de ventas — últimos 7 días">
                {salesLast7.some((d) => d.total > 0) ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={salesLast7} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip formatter={(v) => [formatMoney(v), 'Ventas']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">Sin ventas en los últimos 7 días.</p>}
              </DrawerSection>

              {/* 4. Top mesas */}
              {topMesas.length > 0 && (
                <DrawerSection title="Top 5 mesas por pedidos">
                  <ResponsiveContainer width="100%" height={topMesas.length * 36 + 16}>
                    <BarChart data={topMesas} layout="vertical" margin={{ top: 2, right: 32, left: 4, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="mesa" width={76} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => [`${v} pedidos`]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="pedidos" fill="#8b5cf6" radius={[0, 3, 3, 0]} barSize={18}
                        label={({ x, y, width, height, value }) => (
                          <text x={x + width + 5} y={y + height / 2} dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#8b5cf6">{value}</text>
                        )}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </DrawerSection>
              )}

              {/* 5. Distribución por estado este mes */}
              {statusDist.length > 0 && (
                <DrawerSection title="Pedidos por estado — este mes">
                  <div className="space-y-2">
                    {statusDist.map((s) => {
                      const total = statusDist.reduce((a, b) => a + b.value, 0)
                      const pct   = total > 0 ? Math.round(s.value / total * 100) : 0
                      return (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="text-xs w-20 shrink-0 text-[hsl(var(--foreground))]">{s.name}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.fill }} />
                          </div>
                          <span className="text-xs font-bold w-8 text-right" style={{ color: s.fill }}>{s.value}</span>
                        </div>
                      )
                    })}
                  </div>
                </DrawerSection>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── LocalDashboard ───────────────────────────────────────────── */
function LocalDashboard() {
  const { localId } = useParams()
  const location    = useLocation()
  const { locales } = useLocals()

  const [localInfo, setLocalInfo] = useState(location.state?.local ?? null)

  useEffect(() => {
    if (!localId) return
    getLocalById(localId)
      .then((data) => { if (data?.id) setLocalInfo(data) })
      .catch(() => {})
  }, [localId])

  const localName = useMemo(() => {
    if (localInfo?.name && !/^[0-9a-f]{8}-/.test(localInfo.name)) return localInfo.name
    const found = locales.find((l) => String(l.id) === String(localId))
    return found?.name ?? null
  }, [localInfo, localId, locales])

  const localAddress = useMemo(() => {
    return localInfo?.address || locales.find((l) => String(l.id) === String(localId))?.address || null
  }, [localInfo, localId, locales])

  const [trendRange, setTrendRange]       = useState('7d')
  const [trendData, setTrendData]         = useState(null)
  const [trendLoading, setTrendLoading]   = useState(false)
  const [invKpis, setInvKpis]             = useState(null)
  const [invLoading, setInvLoading]       = useState(true)
  const [dashboard, setDashboard]         = useState(null)
  const [dashLoading, setDashLoading]     = useState(true)
  const [orders, setOrders]               = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [ordersRefreshTick, setOrdersRefreshTick] = useState(0)

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

  /* Procesos recientes */
  const recentOrders = useMemo(() =>
    [...orders]
      .filter((o) => String(o.status || '').toLowerCase() !== 'cancelled')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
  , [orders])

  const finCards = [
    { icon: TrendingUp, label: 'Ventas Hoy',      value: formatMoney(dashboard?.daily_sales),        iconColor: 'text-emerald-600',           iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: DollarSign, label: 'Ventas del Mes',   value: formatMoney(dashboard?.monthly_sales),     iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: Wallet,     label: 'Caja Virtual',     value: formatMoney(dashboard?.monthly_cash_flow), iconColor: 'text-blue-600',              iconBg: 'bg-blue-50',    accentColor: 'border-l-blue-500'   },
    { icon: DollarSign, label: 'Ticket Promedio',  value: formatMoney(dashboard?.avg_ticket ?? 0),   iconColor: 'text-violet-600',            iconBg: 'bg-violet-50',  accentColor: 'border-l-violet-500' },
    { icon: XCircle,    label: 'Cancelaciones',    value: `${Number(dashboard?.cancellation_rate ?? 0).toFixed(1)}%`, iconColor: 'text-red-600', iconBg: 'bg-red-50', accentColor: 'border-l-red-500' },
    { icon: Clock,      label: 'Hora Peak',        value: formatHourAMPM(dashboard?.peak_hour),      iconColor: 'text-amber-600',             iconBg: 'bg-amber-50',   accentColor: 'border-l-amber-500'  },
    { icon: MapPin,     label: 'Mesa Más Activa',  value: dashboard?.top_mesa_name ?? '—',           iconColor: 'text-pink-600',              iconBg: 'bg-pink-50',    accentColor: 'border-l-pink-500'   },
  ]

  const invCards = [
    { icon: Package,       label: 'Total productos',  value: invKpis?.total_products       ?? '—', iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: CheckCircle,   label: 'Stock óptimo',     value: invKpis?.optimal_stock_count  ?? '—', iconColor: 'text-emerald-600',            iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: TrendingDown,  label: 'Stock bajo',       value: invKpis?.low_stock_count      ?? '—', iconColor: 'text-amber-600',              iconBg: 'bg-amber-50',   accentColor: 'border-l-amber-500'   },
    { icon: AlertTriangle, label: 'Stock crítico',    value: invKpis?.critical_stock_count ?? '—', iconColor: 'text-red-600',                iconBg: 'bg-red-50',     accentColor: 'border-l-red-500'     },
    { icon: DollarSign,    label: 'Valor total inv.', value: formatMoney(invKpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
  ]

  return (
    <>
      <KpiDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dashboard={dashboard}
        orders={orders}
        dashLoading={dashLoading}
      />

      <header className="shrink-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-[hsl(var(--foreground))]">
            {localName ?? <span className="inline-block h-4 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />}
          </h1>
          {localAddress && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 max-w-xs truncate">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{formatShortAddress(localAddress)}</span>
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <PageTransition className="flex flex-col gap-6 p-3 sm:p-6 pb-10">

          {/* Resumen Financiero */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen Financiero</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Actividad del local</p>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity shadow-sm"
              >
                <BarChart2 size={14} />
                Ver detalles
              </button>
            </div>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {finCards.map((k, idx) => (
                <motion.div key={k.label} variants={ITEM} data-onboarding={idx === 0 ? 'dashboard-ventas-card' : undefined}>
                  <KpiCard {...k} loading={dashLoading} />
                </motion.div>
              ))}
            </motion.div>
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
                  <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
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
                  <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
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
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Procesos Recientes */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Procesos Recientes</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Últimas órdenes activas del local</p>
            </div>
            <Card>
              <CardContent className="pt-4 pb-2 px-0">
                {ordersLoading ? (
                  <LoadingSpinner message="Cargando órdenes..." />
                ) : recentOrders.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">No hay órdenes recientes.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(var(--border))]">
                          <th className="text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] px-5 pb-2">Hora</th>
                          <th className="text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] px-3 pb-2">ID Orden</th>
                          <th className="text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] px-3 pb-2">Estado</th>
                          <th className="text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] px-3 pb-2">Pago</th>
                          <th className="text-right text-xs font-semibold text-[hsl(var(--muted-foreground))] px-5 pb-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((order) => {
                          const status   = String(order.status || '').toLowerCase()
                          const cfg      = STATUS_CFG[status] || STATUS_CFG.pending
                          const hora     = order.created_at ? new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
                          const shortId  = String(order.id || '').slice(0, 8)
                          const payment  = String(order.payment_method || '').toLowerCase()
                          const payLabel = { cash: 'Efectivo', efectivo: 'Efectivo', debit: 'Débito', debito: 'Débito', credit: 'Crédito', credito: 'Crédito', transfer: 'Transf.', other: 'Otro' }[payment] || payment || '—'
                          return (
                            <tr key={order.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                              <td className="px-5 py-3 text-[hsl(var(--muted-foreground))] text-xs">{hora}</td>
                              <td className="px-3 py-3 font-mono text-xs text-[hsl(var(--foreground))]">{shortId}…</td>
                              <td className="px-3 py-3">
                                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.cls)}>
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]">{payLabel}</td>
                              <td className="px-5 py-3 text-right font-semibold text-[hsl(var(--foreground))]">{formatMoney(order.total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Comparativo semanal + distribución por pago */}
          {!dashLoading && dashboard && (
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
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard size={15} /> Distribución por Pago</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Métodos de pago este mes</p>
                </CardHeader>
                <CardContent>
                  {Array.isArray(dashboard.payment_breakdown) && dashboard.payment_breakdown.length > 0 ? (() => {
                    const LABEL  = { cash: 'Efectivo', efectivo: 'Efectivo', debit: 'Débito', debito: 'Débito', credit: 'Crédito', credito: 'Crédito', transfer: 'Transferencia', other: 'Otro' }
                    const COLORS = ['#16a34a', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280']
                    const payments    = dashboard.payment_breakdown
                    const total       = payments.reduce((s, p) => s + Number(p.total ?? 0), 0)
                    const piePayData  = payments.map((p, i) => ({
                      name:  LABEL[String(p.method).toLowerCase()] || p.method,
                      value: Number(p.total ?? 0),
                      color: COLORS[i % COLORS.length],
                      pct:   total > 0 ? (Number(p.total) / total * 100) : 0,
                    }))
                    return (
                      <div className="flex flex-col items-center gap-3">
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <Pie data={piePayData} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} dataKey="value">
                              {piePayData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip
                              formatter={(v, n) => [formatMoney(v), n]}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                          {piePayData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {entry.name} <span className="font-semibold text-[hsl(var(--foreground))]">{entry.pct.toFixed(0)}%</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })() : (
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
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                variants={STAGGER} initial="hidden" animate="visible"
              >
                {invCards.map((k) => (
                  <motion.div key={k.label} variants={ITEM}>
                    <KpiCard {...k} loading={invLoading} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>

        </PageTransition>
      </div>
    </>
  )
}

export default LocalDashboard
