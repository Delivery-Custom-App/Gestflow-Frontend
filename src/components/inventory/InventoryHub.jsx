import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import {
  Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getInventoryKpisByLocal, getInventoryStockList } from '../../lib/inventoryApi'
import { useAlerts } from '../../hooks/useAlerts'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import { getStockAlertLevel } from './stockAlertUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../../lib/formatCLP'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  ArrowRight, ShoppingCart,
} from 'lucide-react'

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

function AlertCard({ alert }) {
  const cfg         = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium
  const orderPlaced = alert.metadata?.order_placed === true
  const date        = alert.created_at
    ? new Date(alert.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <article className={cn('rounded-xl p-4 shadow-sm', cfg.cls)}>
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
        {alert.status === 'resolved' && !orderPlaced && (
          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Solucionada
          </span>
        )}
        {alert.status === 'resolved' && orderPlaced && (
          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Solucionada vía pedido
          </span>
        )}
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{date}</span>
      </div>
      <h4 className="text-sm font-bold text-[hsl(var(--foreground))]">{alert.title}</h4>
      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{alert.message}</p>
    </article>
  )
}

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}


function InventoryHub() {
  const navigate  = useNavigate()
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const nav = (path) => navigate(`/local/${localId}/${path}`, { state: { local: selectedLocal } })

  const [kpis, setKpis]           = useState(null)
  const [kpisLoading, setKL]      = useState(true)
  const [items, setItems]         = useState([])
  const [itemsLoading, setIL]     = useState(true)

  const { alerts: hookAlerts, loading: alertsLoading } = useAlerts(localId)

  const inventoryAlerts = useMemo(
    () => hookAlerts.filter((a) => a.type === 'inventory_stock' && a.status === 'pending'),
    [hookAlerts]
  )

  const loadKpis = useCallback(async () => {
    if (!localId) { setKL(false); return }
    setKL(true)
    try { setKpis(await getInventoryKpisByLocal(localId)) } catch { setKpis(null) } finally { setKL(false) }
  }, [localId])

  const loadItems = useCallback(async () => {
    if (!localId) { setIL(false); return }
    setIL(true)
    try {
      const rows = await getInventoryStockList(localId)
      setItems(Array.isArray(rows) ? rows : [])
    } catch { setItems([]) } finally { setIL(false) }
  }, [localId])

  useEffect(() => { loadKpis(); loadItems() }, [loadKpis, loadItems])

  /* ── bar chart data: distribución de stock por nivel ─────── */
  const stockDistData = useMemo(() => {
    if (!kpis) return []
    return [
      { name: 'Óptimo',     cantidad: kpis.optimal_stock_count  ?? 0, fill: '#16a34a' },
      { name: 'Stock bajo', cantidad: kpis.low_stock_count      ?? 0, fill: '#f59e0b' },
      { name: 'Crítico',    cantidad: kpis.critical_stock_count ?? 0, fill: '#ef4444' },
    ].filter((d) => d.cantidad > 0)
  }, [kpis])

  /* ── top 5 productos con menos stock (críticos primero) ──── */
  const top5Critical = useMemo(() =>
    [...items]
      .filter((r) => getStockAlertLevel(r))
      .sort((a, b) => Number(a.stock_current ?? 0) - Number(b.stock_current ?? 0))
      .slice(0, 5)
      .map((r) => ({
        name:   (r.product_name || r.name || 'Producto').length > 14
                  ? (r.product_name || r.name).slice(0, 13) + '…'
                  : (r.product_name || r.name || 'Producto'),
        Stock:  Number(r.stock_current ?? 0),
        Mínimo: Number(r.stock_min ?? 0),
      }))
  , [items])

  /* ── KPI cards ─────────────────────────────────────────────── */
  const KPI_CARDS = [
    { icon: Package,       label: 'Total productos',  value: kpis?.total_products ?? '—',       iconColor: 'text-[hsl(var(--primary))]', bg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
    { icon: CheckCircle,   label: 'Stock óptimo',     value: kpis?.optimal_stock_count ?? '—',  iconColor: 'text-emerald-600',            bg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
    { icon: TrendingDown,  label: 'Stock bajo',       value: kpis?.low_stock_count ?? '—',      iconColor: 'text-amber-600',              bg: 'bg-amber-50',   accent: 'border-l-amber-500'   },
    { icon: AlertTriangle, label: 'Stock crítico',    value: kpis?.critical_stock_count ?? '—', iconColor: 'text-red-600',                bg: 'bg-red-50',     accent: 'border-l-red-500'     },
    { icon: DollarSign,    label: 'Valor total',      value: formatMoney(kpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', bg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
  ]

  const loading = kpisLoading || itemsLoading

  return (
    <InventoryShell>
      <div className="px-6 py-6 flex flex-col gap-6 pb-10">
        {loading && !kpis && !items.length ? (
          <LoadingSpinner message="Cargando inventario..." />
        ) : (
          <>
            {/* KPI cards */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {KPI_CARDS.map((k) => (
                <motion.div key={k.label} variants={ITEM}>
                  <Card className={`border-l-4 ${k.accent} h-full`}>
                    <CardContent className="flex items-center gap-4 p-5">
                      <span className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${k.bg} ${k.iconColor}`}>
                        <k.icon size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-tight">{k.label}</p>
                        {kpisLoading
                          ? <div className="h-8 w-14 bg-[hsl(var(--muted))] rounded animate-pulse mt-1" />
                          : <p className={`text-2xl font-bold mt-0.5 ${k.iconColor}`}>{k.value}</p>
                        }
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Bar chart — distribución de stock por nivel con cantidades */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribución de Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpisLoading ? (
                    <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
                  ) : stockDistData.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stockDistData} margin={{ top: 28, right: 16, left: -16, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(v) => [`${v} productos`]}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={56} label={{ position: 'top', fontSize: 12, fontWeight: 700, fill: 'hsl(var(--foreground))' }}>
                          {stockDistData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Bar chart — top 5 productos críticos por menor stock */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Productos Críticos</CardTitle>
                </CardHeader>
                <CardContent>
                  {itemsLoading ? (
                    <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
                  ) : top5Critical.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                      No hay productos críticos. Todo en orden.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={top5Critical} layout="vertical" barCategoryGap="55%" margin={{ left: 4, right: 44, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="Stock" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={18} minPointSize={0}
                          label={({ x, y, width, height, value }) => (
                            <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#ef4444">
                              {value}
                            </text>
                          )}
                        />
                        <Bar dataKey="Mínimo" fill="#64748b" radius={[0, 3, 3, 0]} barSize={18} minPointSize={0} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alertas de inventario — misma lógica y diseño que AdministrativeModule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    Alertas de inventario
                    {inventoryAlerts.length > 0 && (
                      <Badge variant="destructive" className="text-xs px-2 py-0.5">{inventoryAlerts.length}</Badge>
                    )}
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" onClick={() => nav('inventario/compras-semanales')} className="gap-1 text-sm">
                    Ir a Pedidos <ArrowRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {alertsLoading ? (
                  <LoadingSpinner message="Cargando alertas..." />
                ) : inventoryAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-emerald-600">
                    <CheckCircle size={16} />
                    Todo el inventario está en niveles óptimos.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {inventoryAlerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </InventoryShell>
  )
}

export default InventoryHub
