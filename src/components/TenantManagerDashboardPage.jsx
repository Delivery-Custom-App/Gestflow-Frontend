import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, Users, Store, ShoppingCart, DollarSign, TrendingUp,
  Loader2, ChevronRight, Activity,
} from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import { getGlobalStats } from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PLAN_LABEL = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Standard' }

const PLAN_BADGE = {
  enterprise: 'bg-violet-100 text-violet-700 border-violet-200',
  professional: 'bg-blue-100 text-blue-700 border-blue-200',
  starter: 'bg-stone-100 text-stone-700 border-stone-200',
}

const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En preparación',
  ready: 'Lista',
  completed: 'Completada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0)
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function KpiCard({ icon: Icon, label, value, sub, tint }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{value}</p>
            {sub && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint || 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBar({ data }) {
  const items = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  if (!items.length) return <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin datos</p>
  const total = items.reduce((acc, [, v]) => acc + v, 0) || 1
  return (
    <div className="space-y-2">
      {items.map(([key, value]) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[hsl(var(--muted-foreground))]">{STATUS_LABEL[key] || key}</span>
            <span className="font-semibold text-[hsl(var(--foreground))]">{value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(value / total) * 100}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full bg-[hsl(var(--primary))]"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DistributionList({ data, color }) {
  const items = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  if (!items.length) return <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin datos</p>
  const total = items.reduce((acc, [, v]) => acc + v, 0) || 1
  return (
    <div className="space-y-2">
      {items.map(([key, value]) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[hsl(var(--muted-foreground))]">{key}</span>
            <span className="font-semibold text-[hsl(var(--foreground))]">{value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(value / total) * 100}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${color || 'bg-[hsl(var(--primary))]'}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TenantManagerDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const stats = await getGlobalStats(ctx.token)
      setData(stats)
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar el resumen global')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))] p-8">
        <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando resumen global…
        </p>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))] p-8">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
      </div>
    )
  }

  const totals = data.totals || {}

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Resumen Global</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">KPIs de todas las franquicias</p>
            </div>
          </div>
          <Link
            to="/gestor"
            className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Ver franquicias <ChevronRight size={15} />
          </Link>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard icon={Building2} label="Franquicias" value={totals.businesses || 0} sub={`${totals.active_businesses || 0} activas`} tint="bg-violet-100 text-violet-700" />
          <KpiCard icon={Users} label="Usuarios" value={totals.users || 0} sub="en todas las franquicias" tint="bg-blue-100 text-blue-700" />
          <KpiCard icon={Store} label="Locales" value={totals.locals || 0} sub="sucursales registradas" tint="bg-emerald-100 text-emerald-700" />
          <KpiCard icon={ShoppingCart} label="Órdenes" value={totals.orders || 0} sub={`${totals.monthly_orders || 0} este mes`} tint="bg-amber-100 text-amber-700" />
          <KpiCard icon={DollarSign} label="Ingresos" value={formatCurrency(totals.revenue)} sub="históricos" tint="bg-green-100 text-green-700" />
          <KpiCard icon={TrendingUp} label="Ingresos del mes" value={formatCurrency(totals.monthly_revenue)} sub="período actual" tint="bg-cyan-100 text-cyan-700" />
        </div>

        {/* Distribuciones */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Órdenes por estado</h3>
              <StatusBar data={data.orders_by_status} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Usuarios por rol</h3>
              <DistributionList data={data.users_by_role} color="bg-blue-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Franquicias por plan</h3>
              <DistributionList data={data.businesses_by_plan} color="bg-violet-500" />
            </CardContent>
          </Card>
        </div>

        {/* Actividad por franquicia */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Actividad por franquicia</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="pb-2 pr-3 font-medium">Franquicia</th>
                    <th className="pb-2 pr-3 font-medium">Plan</th>
                    <th className="pb-2 pr-3 font-medium">Estado</th>
                    <th className="pb-2 pr-3 font-medium text-right">Locales</th>
                    <th className="pb-2 pr-3 font-medium text-right">Usuarios</th>
                    <th className="pb-2 pr-3 font-medium text-right">Órdenes</th>
                    <th className="pb-2 pr-3 font-medium text-right">Ingresos</th>
                    <th className="pb-2 pr-3 font-medium text-right">Del mes</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {(data.tenants || []).map((t) => (
                    <tr key={t.id} className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                      <td className="py-2.5 pr-3">
                        <Link to={`/gestor/negocios/${t.id}`} className="font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]">
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${PLAN_BADGE[t.plan] || PLAN_BADGE.starter}`}>
                          {PLAN_LABEL[t.plan] || t.plan}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.is_active ? (
                          <span className="text-xs font-medium text-emerald-700">Activa</span>
                        ) : (
                          <span className="text-xs font-medium text-red-600">Inactiva</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-[hsl(var(--foreground))]">{t.locals}</td>
                      <td className="py-2.5 pr-3 text-right text-[hsl(var(--foreground))]">{t.users}</td>
                      <td className="py-2.5 pr-3 text-right text-[hsl(var(--foreground))]">{t.orders}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-[hsl(var(--foreground))]">{formatCurrency(t.revenue)}</td>
                      <td className="py-2.5 pr-3 text-right text-[hsl(var(--foreground))]">{formatCurrency(t.monthly_revenue)}</td>
                      <td className="py-2.5 text-right">
                        <Link to={`/gestor/negocios/${t.id}`} className="text-[hsl(var(--primary))] hover:underline text-xs font-medium">
                          Detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(data.tenants || []).length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-6 text-center text-[hsl(var(--muted-foreground))]">Sin franquicias registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">Creada {data.generated_at ? formatDate(data.generated_at) : ''}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
