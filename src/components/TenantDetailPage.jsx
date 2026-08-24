import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, Store, Users, ShoppingCart, DollarSign, TrendingUp,
  Loader2, Shield, History, Power,
} from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import { getBusinessStats, updateBusiness } from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const PLAN_LABEL = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Standard', basic: 'Standard' }
const PLAN_BADGE = {
  enterprise: 'bg-violet-100 text-violet-700 border-violet-200',
  professional: 'bg-blue-100 text-blue-700 border-blue-200',
  starter: 'bg-stone-100 text-stone-700 border-stone-200',
  basic: 'bg-stone-100 text-stone-700 border-stone-200',
}

const ACTION_LABEL = {
  'business.create': 'Creación de franquicia',
  'business.update': 'Actualización de franquicia',
  'business.delete': 'Eliminación de franquicia',
  'business.deactivate': 'Suspensión de franquicia',
  'business.reactivate': 'Reactivación de franquicia',
  'user.create': 'Alta de usuario',
  'user.update': 'Actualización de usuario',
  'user.role_change': 'Cambio de rol',
  'user.deactivate': 'Desactivación de usuario',
  'user.reactivate': 'Reactivación de usuario',
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

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] shrink-0">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
          <p className="text-lg font-bold text-[hsl(var(--foreground))] truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBar({ data }) {
  const items = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  if (!items.length) return <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin órdenes registradas.</p>
  const total = items.reduce((acc, [, v]) => acc + v, 0) || 1
  return (
    <div className="space-y-2">
      {items.map(([key, value]) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[hsl(var(--muted-foreground))] capitalize">{key}</span>
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

export default function TenantDetailPage() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const stats = await getBusinessStats(businessId, ctx.token)
      setData(stats)
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar el detalle del negocio')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async () => {
    if (!data?.business) return
    const next = data.business.is_active === false
    const ok = window.confirm(
      next
        ? `¿Reactivar "${data.business.name}"? Sus usuarios activos podrán volver a entrar.`
        : `¿Suspender "${data.business.name}"? Sus usuarios no podrán iniciar sesión hasta que la reactives.`
    )
    if (!ok) return
    setToggling(true)
    setErr('')
    try {
      const ctx = await getAuthContext()
      await updateBusiness(businessId, { is_active: next }, ctx.token)
      await load()
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'No se pudo cambiar el estado')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))] p-8">
        <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando detalle…
        </p>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))] p-8">
        <button onClick={() => navigate('/gestor')} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] mb-4">
          <ArrowLeft size={15} /> Volver
        </button>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
      </div>
    )
  }

  const business = data.business || {}
  const stats = data.stats || {}
  const isActive = business.is_active !== false

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-5">
        <button onClick={() => navigate('/gestor')} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]">
          <ArrowLeft size={15} /> Volver al gestor
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
            <Building2 size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{business.name || 'Sin nombre'}</h1>
              <Badge className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${PLAN_BADGE[business.plan] || PLAN_BADGE.starter}`}>
                {PLAN_LABEL[business.plan] || business.plan}
              </Badge>
              {isActive ? (
                <span className="text-xs font-medium text-emerald-700">Activa</span>
              ) : (
                <span className="text-xs font-medium text-red-600">Inactiva · acceso bloqueado</span>
              )}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {business.rut || 'Sin RUT'} · Creada {formatDate(business.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isActive ? 'outline' : 'default'}
              size="sm"
              onClick={handleToggleActive}
              disabled={toggling}
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power size={14} className={isActive ? 'text-red-500' : 'text-emerald-600'} />
              )}
              {isActive ? 'Suspender' : 'Reactivar'}
            </Button>
            <Link to="/gestor/auditoria" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
              Ver auditoría global
            </Link>
          </div>
        </div>

        {!isActive && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Esta franquicia está suspendida. Los usuarios del tenant no pueden iniciar sesión hasta que la reactives.
          </div>
        )}

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <MiniStat icon={Store} label="Locales" value={stats.locals || 0} />
          <MiniStat icon={Users} label="Usuarios" value={stats.users || 0} />
          <MiniStat icon={Shield} label="Administradores" value={stats.admins || 0} />
          <MiniStat icon={ShoppingCart} label="Órdenes" value={stats.orders || 0} />
          <MiniStat icon={DollarSign} label="Ingresos" value={formatCurrency(stats.revenue)} />
          <MiniStat icon={TrendingUp} label="Del mes" value={formatCurrency(stats.monthly_revenue)} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Órdenes por estado */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Órdenes por estado</h3>
              <StatusBar data={data.orders_by_status} />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">{stats.monthly_orders || 0} órdenes este mes</p>
            </CardContent>
          </Card>

          {/* Administradores */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Administradores ({stats.admins || 0})</h3>
              {(data.admins || []).length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin administradores registrados.</p>
              ) : (
                <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                  {(data.admins || []).map((admin) => (
                    <div key={admin.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{admin.name || admin.email}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{admin.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {admin.is_active === false && <span className="text-xs font-medium text-red-600">Inactivo</span>}
                        <Badge className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border bg-blue-100 text-blue-700 border-blue-200">
                          {admin.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Auditoría reciente */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <History size={15} className="text-[hsl(var(--primary))]" />
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Auditoría reciente</h3>
            </div>
            {(data.audit || []).length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin eventos registrados.</p>
            ) : (
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {(data.audit || []).map((e, i) => (
                  <div key={e.id || i} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {ACTION_LABEL[e.action] || e.action}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatDateTime(e.created_at)}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {e.actor_email || e.actor_user_id || 'Usuario desconocido'}
                      {e.target_label ? ` · ${e.target_label}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
