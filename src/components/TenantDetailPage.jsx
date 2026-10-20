import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { m } from 'framer-motion'
import { formatCLPCurrency } from '../lib/formatCLP'
import {
  ArrowLeft, Building2, Store, Users, ShoppingCart, DollarSign, TrendingUp,
  Loader2, Shield, History, Power, UtensilsCrossed, Table2, UserPlus, Pencil, KeyRound, Plus,
} from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import {
  createBusinessLocal,
  getBusinessStats,
  listAllUsers,
  listBusinessLocals,
  updateBusiness,
  updateLocalSalesModel,
} from '../lib/superAdminApi'
import { SALES_MODEL, SALES_MODEL_LABEL, isAlPasoLocal } from '../lib/salesModel'
import { ROL_LABEL } from '../lib/altaUsuario'
import { cambiarEstadoUsuario, restablecerClave, textoDeError } from '../lib/gestionUsuarios'
import { CreateUserDrawer } from './UsersListPage'
import EditarUsuarioDialog from './EditarUsuarioDialog'
import ClaveTemporalDialog from './ClaveTemporalDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Roles que el superadmin asigna dentro de una franquicia (#134): nunca otro superadmin.
const ROLES_DE_FRANQUICIA = ['ADMIN_NEGOCIO', 'ADMIN', 'EMPLEADO']
const ORDEN_ROL = { ADMIN_NEGOCIO: 0, ADMIN: 1, EMPLEADO: 2 }
const ROLE_BADGE = {
  ADMIN_NEGOCIO: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  EMPLEADO: 'bg-stone-100 text-stone-700 border-stone-200',
}

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
  'local.create': 'Apertura de local',
  'user.create': 'Alta de usuario',
  'user.update': 'Actualización de usuario',
  'user.role_change': 'Cambio de rol',
  'user.deactivate': 'Desactivación de usuario',
  'user.reactivate': 'Reactivación de usuario',
}

const formatCurrency = formatCLPCurrency

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
            <m.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: value / total }}
              transition={{ duration: 0.6 }}
              style={{ originX: 0 }}
              className="h-full w-full rounded-full bg-[hsl(var(--primary))]"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function NuevoLocalDialog({ businessId, onClose, onCreado }) {
  const [name, setName] = useState('')
  const [salesModel, setSalesModel] = useState(SALES_MODEL.RESTAURANT)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Ingresa el nombre del local.'); return }
    setGuardando(true)
    setError('')
    try {
      const ctx = await getAuthContext()
      await createBusinessLocal(businessId, { name: name.trim(), salesModel }, ctx.token)
      onCreado()
    } catch (e2) {
      setError(textoDeError(e2, 'No se pudo crear el local'))
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo local</DialogTitle>
          <DialogDescription>Abre un local para esta franquicia.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nl-name">Nombre <span className="text-red-500">*</span></Label>
              <Input id="nl-name" placeholder="Casa matriz" value={name} onChange={(e) => setName(e.target.value)} disabled={guardando} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nl-model">Modo de venta</Label>
              <select id="nl-model" value={salesModel} onChange={(e) => setSalesModel(e.target.value)} disabled={guardando}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                <option value={SALES_MODEL.RESTAURANT}>{SALES_MODEL_LABEL.RESTAURANT}</option>
                <option value={SALES_MODEL.AL_PASO}>{SALES_MODEL_LABEL.AL_PASO}</option>
              </select>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Creando…</span> : 'Crear local'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export default function TenantDetailPage() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [locals, setLocals] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [savingLocalId, setSavingLocalId] = useState('')
  const [err, setErr] = useState('')
  const [users, setUsers] = useState([])
  const [creandoUsuario, setCreandoUsuario] = useState(false)
  const [creandoLocal, setCreandoLocal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [ocupadoId, setOcupadoId] = useState('')
  const [claveTemporal, setClaveTemporal] = useState(null) // { nombre, clave, correoEnviado }, solo en memoria

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const [stats, localRows, userRows] = await Promise.all([
        getBusinessStats(businessId, ctx.token),
        listBusinessLocals(businessId, ctx.token),
        listAllUsers({ businessId }, ctx.token),
      ])
      setData(stats)
      setLocals(Array.isArray(localRows) ? localRows : [])
      setUsers(Array.isArray(userRows) ? userRows : [])
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar el detalle del negocio')
      setData(null)
      setLocals([])
      setUsers([])
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

  const handleSalesModelChange = async (local, nextModel) => {
    if (!local?.id || String(local.sales_model) === String(nextModel)) return
    setSavingLocalId(String(local.id))
    setErr('')
    try {
      const ctx = await getAuthContext()
      await updateLocalSalesModel(local.id, nextModel, ctx.token)
      setLocals((prev) =>
        prev.map((row) =>
          String(row.id) === String(local.id) ? { ...row, sales_model: nextModel } : row,
        ),
      )
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'No se pudo cambiar el modo de venta')
    } finally {
      setSavingLocalId('')
    }
  }

  const nombreDe = (u) => u.name || u.email

  const handleToggleUser = async (u) => {
    const activar = u.is_active === false
    const ok = window.confirm(
      activar
        ? `¿Reactivar a ${nombreDe(u)}? Podrá volver a iniciar sesión.`
        : `¿Desactivar a ${nombreDe(u)}? No podrá iniciar sesión; su historial se conserva.`
    )
    if (!ok) return
    setOcupadoId(String(u.id))
    setErr('')
    try {
      await cambiarEstadoUsuario(u.id, activar)
      await load()
    } catch (e2) {
      setErr(textoDeError(e2, 'No se pudo cambiar el estado del usuario'))
    } finally {
      setOcupadoId('')
    }
  }

  const handleResetPassword = async (u) => {
    if (!window.confirm(`¿Restablecer la clave de ${nombreDe(u)}? Se cerrarán sus sesiones y deberá cambiarla al entrar.`)) return
    setOcupadoId(String(u.id))
    setErr('')
    try {
      const r = await restablecerClave(u.id)
      setClaveTemporal({ nombre: nombreDe(u), clave: r?.temporary_password || '', correoEnviado: Boolean(r?.email_sent) })
    } catch (e2) {
      setErr(textoDeError(e2, 'No se pudo restablecer la clave'))
    } finally {
      setOcupadoId('')
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

  // Sin datos no hay página; un error de una acción se muestra en línea, sin perderla.
  if (!data) {
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

        {/* Locales y su modo de venta */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Locales ({locals.length})</h3>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Activa <strong>comida al paso</strong> para locales sin mesas (solo caja + menú).
                  Con mesas mantiene el POS de restaurante.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCreandoLocal(true)}>
                <Plus size={14} /> Nuevo local
              </Button>
            </div>
            {locals.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Este negocio aún no tiene locales.</p>
            ) : (
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {locals.map((local) => {
                  const alPaso = isAlPasoLocal(local)
                  const saving = String(savingLocalId) === String(local.id)
                  return (
                    <div key={local.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] shrink-0">
                          {alPaso ? <UtensilsCrossed size={16} /> : <Table2 size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{local.name}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {SALES_MODEL_LABEL[local.sales_model] || local.sales_model || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select aria-label={`Modelo de venta de ${local.name}`}
                          value={alPaso ? SALES_MODEL.AL_PASO : SALES_MODEL.RESTAURANT}
                          disabled={saving}
                          onChange={(e) => handleSalesModelChange(local, e.target.value)}
                          className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-xs font-medium disabled:opacity-60"
                        >
                          <option value={SALES_MODEL.RESTAURANT}>{SALES_MODEL_LABEL.RESTAURANT}</option>
                          <option value={SALES_MODEL.AL_PASO}>{SALES_MODEL_LABEL.AL_PASO}</option>
                        </select>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--muted-foreground))]" /> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Usuarios del negocio (#134) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Usuarios ({users.length})</h3>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Dueño, encargados y vendedores de esta franquicia. Los encargados y vendedores trabajan en un local.
                </p>
              </div>
              <Button size="sm" onClick={() => setCreandoUsuario(true)}>
                <UserPlus size={14} /> Nuevo usuario
              </Button>
            </div>
            {users.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Sin usuarios. Crea la cuenta del dueño para que pueda entrar a configurar su negocio.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {[...users]
                  .sort((a, b) => (ORDEN_ROL[a.role] ?? 9) - (ORDEN_ROL[b.role] ?? 9) || nombreDe(a).localeCompare(nombreDe(b), 'es'))
                  .map((u) => {
                    const busy = String(ocupadoId) === String(u.id)
                    const local = locals.find((l) => String(l.id) === String(u.local_id))
                    const inactivo = u.is_active === false
                    return (
                      <div key={u.id} className={`py-2.5 flex flex-wrap items-center justify-between gap-3 ${inactivo ? 'opacity-70' : ''}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{nombreDe(u)}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                            {u.email}{local ? ` · ${local.name}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inactivo && <span className="text-xs font-medium text-red-600 mr-1">Inactivo</span>}
                          <Badge className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${ROLE_BADGE[u.role] || ROLE_BADGE.EMPLEADO}`}>
                            {ROL_LABEL[u.role] || u.role}
                          </Badge>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditando(u)} title="Editar" aria-label={`Editar a ${nombreDe(u)}`}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy || inactivo} onClick={() => handleResetPassword(u)} title="Restablecer clave" aria-label={`Restablecer la clave de ${nombreDe(u)}`}>
                            <KeyRound size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleToggleUser(u)}
                            title={inactivo ? 'Reactivar' : 'Desactivar'} aria-label={`${inactivo ? 'Reactivar' : 'Desactivar'} a ${nombreDe(u)}`}>
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power size={14} className={inactivo ? 'text-emerald-600' : 'text-red-500'} />}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

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
                {(data.audit || []).map((e) => (
                  <div key={e.id} className="py-2.5">
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

      <CreateUserDrawer
        isOpen={creandoUsuario}
        onClose={() => setCreandoUsuario(false)}
        onSuccess={load}
        locales={locals}
        localesLoading={false}
        userRole="SUPERADMIN"
        roles={ROLES_DE_FRANQUICIA}
        businessId={businessId}
      />
      {editando && (
        <EditarUsuarioDialog
          usuario={editando}
          locales={locals}
          miRol="SUPERADMIN"
          roles={ROLES_DE_FRANQUICIA}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); load() }}
        />
      )}
      {creandoLocal && (
        <NuevoLocalDialog
          businessId={businessId}
          onClose={() => setCreandoLocal(false)}
          onCreado={() => { setCreandoLocal(false); load() }}
        />
      )}
      {claveTemporal && <ClaveTemporalDialog {...claveTemporal} onClose={() => setClaveTemporal(null)} />}
    </div>
  )
}
