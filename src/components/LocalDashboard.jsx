import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../lib/formatCLP'
import { useLocals } from '../hooks/useLocals'
import { getInventoryKpisByLocal } from '../lib/inventoryApi'
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
  TrendingUp, Wallet, Clock, XCircle, MapPin, CreditCard,
} from 'lucide-react'

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444']

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


function LocalDashboard() {
  const { localId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { locales } = useLocals()

  const localName = useMemo(() => {
    const stateLocalName = location.state?.local?.name
    if (stateLocalName && !/^[0-9a-f]{8}-/.test(stateLocalName)) return stateLocalName
    const found = locales.find((l) => String(l.id) === String(localId))
    return found?.name || `Local ${localId ?? ''}`
  }, [location.state, localId, locales])

  const localAddress = useMemo(() => {
    const found = locales.find((l) => String(l.id) === String(localId))
    return found?.address || location.state?.local?.address || null
  }, [location.state, localId, locales])

  const navState = useMemo(() => ({ local: { id: localId, name: localName } }), [localId, localName])

  const [trendRange, setTrendRange] = useState('7d')
  const [trendData, setTrendData] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [invKpis, setInvKpis] = useState(null)
  const [invLoading, setInvLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)

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

  // Fetch 7-day trend (ingresos vs flujo neto) from dedicated endpoint
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

  const finCards = [
    { icon: TrendingUp, label: 'Ventas Hoy',     value: formatMoney(dashboard?.daily_sales),        iconColor: 'text-emerald-600',           iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: DollarSign, label: 'Ventas del Mes',  value: formatMoney(dashboard?.monthly_sales),     iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: Wallet,     label: 'Caja Virtual',    value: formatMoney(dashboard?.monthly_cash_flow), iconColor: 'text-blue-600',              iconBg: 'bg-blue-50',    accentColor: 'border-l-blue-500'   },
    { icon: DollarSign, label: 'Ticket Promedio',  value: formatMoney(dashboard?.avg_ticket ?? 0),  iconColor: 'text-violet-600',            iconBg: 'bg-violet-50',  accentColor: 'border-l-violet-500' },
    { icon: XCircle,    label: 'Cancelaciones',   value: `${Number(dashboard?.cancellation_rate ?? 0).toFixed(1)}%`, iconColor: 'text-red-600', iconBg: 'bg-red-50', accentColor: 'border-l-red-500' },
    { icon: Clock,      label: 'Hora Pico',       value: dashboard?.peak_hour != null ? `${dashboard.peak_hour}:00h` : '—', iconColor: 'text-amber-600', iconBg: 'bg-amber-50', accentColor: 'border-l-amber-500' },
    { icon: MapPin,     label: 'Mesa Más Activa', value: dashboard?.top_mesa_name ?? '—',           iconColor: 'text-pink-600',              iconBg: 'bg-pink-50',    accentColor: 'border-l-pink-500'   },
  ]

  const invCards = [
    { icon: Package,       label: 'Total productos', value: invKpis?.total_products       ?? '—', iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: CheckCircle,   label: 'Stock óptimo',    value: invKpis?.optimal_stock_count  ?? '—', iconColor: 'text-emerald-600',            iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: TrendingDown,  label: 'Stock bajo',      value: invKpis?.low_stock_count      ?? '—', iconColor: 'text-amber-600',              iconBg: 'bg-amber-50',   accentColor: 'border-l-amber-500'   },
    { icon: AlertTriangle, label: 'Stock crítico',   value: invKpis?.critical_stock_count ?? '—', iconColor: 'text-red-600',                iconBg: 'bg-red-50',     accentColor: 'border-l-red-500'     },
    { icon: DollarSign,    label: 'Valor total inv.', value: formatMoney(invKpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
  ]

  return (
    <>
      <header className="shrink-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-[hsl(var(--foreground))]">{localName}</h1>
          {localAddress && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 max-w-xs truncate">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{localAddress}</span>
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <PageTransition className="flex flex-col gap-6 p-3 sm:p-6 pb-10">

          {/* Resumen Financiero */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen Financiero</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Actividad del local</p>
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
                    {[
                      { key: '1h',  label: '1h'  },
                      { key: '4h',  label: '4h'  },
                      { key: '12h', label: '12h' },
                      { key: '1d',  label: '1d'  },
                      { key: '7d',  label: '7d'  },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setTrendRange(key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          trendRange === key
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(trendRange === '7d' ? trendLoading : ordersLoading) ? (
                  <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
                ) : incomeTrend.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Sin pedidos registrados en el período.
                  </p>
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
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Sin datos de inventario.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={pieData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={28}
                      />
                      <Tooltip
                        formatter={(v, n) => [`${v} productos`, n]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>


          {/* Comparativo semanal + distribución por pago */}
          {!dashLoading && dashboard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Comparativo semanal */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativo Semanal</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Esta semana vs semana anterior</p>
                </CardHeader>
                <CardContent>
                  {dashboard.week_comparison ? (() => {
                    const wc = dashboard.week_comparison
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

              {/* Distribución por método de pago */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard size={15} /> Distribución por Pago</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Métodos de pago este mes</p>
                </CardHeader>
                <CardContent>
                  {Array.isArray(dashboard.payment_breakdown) && dashboard.payment_breakdown.length > 0 ? (() => {
                    const LABEL  = { cash: 'Efectivo', efectivo: 'Efectivo', debit: 'Débito', debito: 'Débito', credit: 'Crédito', credito: 'Crédito', transfer: 'Transferencia', other: 'Otro' }
                    const COLORS = ['#16a34a', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280']
                    const payments = dashboard.payment_breakdown
                    const total = payments.reduce((s, p) => s + Number(p.total ?? 0), 0)
                    const piePayData = payments.map((p, i) => ({
                      name: LABEL[String(p.method).toLowerCase()] || p.method,
                      value: Number(p.total ?? 0),
                      color: COLORS[i % COLORS.length],
                      pct: total > 0 ? (Number(p.total) / total * 100) : 0,
                    }))
                    return (
                      <div className="flex flex-col items-center gap-3">
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <Pie
                              data={piePayData}
                              cx="50%" cy="50%"
                              innerRadius={46} outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {piePayData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v, n) => [formatMoney(v), n]}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: 12,
                              }}
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
