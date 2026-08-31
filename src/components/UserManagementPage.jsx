import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdminRole } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'
import { useLocals } from '../hooks/useLocals'
import { createUser } from '../lib/apiClient'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const ROLES = [
  { value: 'EMPLEADO',   label: 'Empleado — solo POS' },
  { value: 'ADMIN',      label: 'Admin — su local (inventario, etc.)' },
  { value: 'ADMIN_NEGOCIO', label: 'Dueño de negocio — toda la franquicia' },
  { value: 'SUPERADMIN', label: 'Superadmin — acceso total' },
]

const HIGH_ROLES = new Set(['ADMIN', 'ADMIN_NEGOCIO', 'SUPERADMIN'])

const ROLE_WARNING = {
  ADMIN:      'Este usuario podrá administrar inventario, proveedores y reportes de su local.',
  ADMIN_NEGOCIO: 'Este usuario será el dueño de la franquicia y podrá crear sub-administradores y ver toda su red.',
  SUPERADMIN: 'Este usuario tendrá acceso total al sistema, incluyendo todos los locales y configuraciones críticas.',
}

const inputCls =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm text-[hsl(var(--foreground))] ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 focus:border-[hsl(var(--primary))]'
const labelCls = 'block text-sm font-medium text-[hsl(var(--foreground))] mb-1'

function generatePassword() {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function UserManagementPage() {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const { locales, loading: localesLoading } = useLocals()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [roleConfirmed, setRoleConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')

  const isOwnerRole = String(userRole || '').toLowerCase().replace(/[\s_-]+/g, '') === 'adminnegocio'
  const availableRoles = isSuperAdminRole(userRole)
    ? ROLES
    : isOwnerRole
      ? ROLES.filter((r) => r.value === 'ADMIN' || r.value === 'EMPLEADO')
      : ROLES.filter((r) => r.value === 'EMPLEADO')
  const needsConfirm = HIGH_ROLES.has(form.role)

  if (!isInventoryAdminRole(userRole)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(var(--background))]">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <h2 className="text-lg font-bold text-red-600">No autorizado</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">No tienes permisos para crear usuarios.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/')}>Volver</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const set = (k) => (e) => {
    const val = e.target.value
    setForm((f) => ({ ...f, [k]: val }))
    if (k === 'role') setRoleConfirmed(false)
  }

  const handleGeneratePassword = () => {
    const pwd = generatePassword()
    setForm((f) => ({ ...f, password: pwd }))
    setShowPassword(true)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setOk(''); setErr('')
    if (!form.name || !form.email || !form.password) { setErr('Completa nombre, correo y contraseña.'); return }
    if (form.password.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (!['SUPERADMIN', 'ADMIN_NEGOCIO'].includes(form.role) && !form.local_id) { setErr('Selecciona el local al que pertenece este usuario.'); return }
    if (needsConfirm && !roleConfirmed) { setErr('Debes confirmar la asignación de este rol antes de continuar.'); return }
    setLoading(true)
    try {
      const local = locales.find((l) => String(l.id) === String(form.local_id))
      await createUser({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        role: form.role, local_id: form.local_id || null,
        business_id: local?.business_id || null,
      })
      const localName = local?.name
      setOk(`Usuario "${form.email.trim()}" creado como ${form.role}${localName ? ` en "${localName}"` : ''}.`)
      setForm({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
      setRoleConfirmed(false)
      setShowPassword(false)
    } catch (e2) {
      setErr(e2.detail || e2.message || 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/usuarios')}>
          <ArrowLeft size={16} /> Volver a la lista
        </Button>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
                <UserPlus size={18} />
              </span>
              Crear usuario
            </CardTitle>
            <CardDescription>Define nombre, correo, contraseña, rol y local.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nombre</label>
                  <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Juan Pérez" />
                </div>
                <div>
                  <label className={labelCls}>Correo</label>
                  <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="juan@correo.com" />
                </div>

                {/* Contraseña con generador */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>Contraseña</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        className={inputCls + ' pr-10'}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={set('password')}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword} className="shrink-0 gap-1.5">
                      <RefreshCw size={13} /> Generar
                    </Button>
                  </div>
                  {showPassword && form.password && (
                    <p className="text-xs text-amber-600 mt-1">Copia la contraseña antes de guardar — no se mostrará nuevamente.</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>Rol</label>
                  <select className={inputCls} value={form.role} onChange={set('role')}>
                    {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {!['SUPERADMIN', 'ADMIN_NEGOCIO'].includes(form.role) && (
                <div>
                  <label className={labelCls}>Local asignado</label>
                  <select className={inputCls} value={form.local_id} onChange={set('local_id')} disabled={localesLoading}>
                    <option value="">{localesLoading ? 'Cargando locales…' : '— Selecciona un local —'}</option>
                    {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">El usuario solo tendrá acceso a este local.</p>
                </div>
              )}

              {/* Doble verificación para roles elevados */}
              {needsConfirm && (
                <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleConfirmed}
                    onChange={(e) => setRoleConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-amber-600 shrink-0"
                  />
                  <span className="text-sm text-amber-800">
                    <span className="font-semibold">Confirmo la asignación de rol {form.role}. </span>
                    {ROLE_WARNING[form.role]}
                  </span>
                </label>
              )}

              {ok && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {ok} <button type="button" onClick={() => navigate('/usuarios')} className="underline font-medium ml-1">Ver lista</button>
                </div>
              )}
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line">{err}</div>}

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading || (needsConfirm && !roleConfirmed)}>
                  {loading ? 'Creando…' : 'Crear usuario'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/usuarios')}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
