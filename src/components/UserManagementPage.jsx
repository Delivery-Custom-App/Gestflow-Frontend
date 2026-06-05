import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdminRole } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'
import { useLocals } from '../hooks/useLocals'
import { createUser } from '../lib/apiClient'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const ROLES = [
  { value: 'EMPLEADO', label: 'Empleado — solo POS' },
  { value: 'ADMIN', label: 'Admin — su local (inventario, etc.)' },
  { value: 'SUPERADMIN', label: 'Superadmin — acceso total' },
]

const inputCls =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm text-[hsl(var(--foreground))] ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 focus:border-[hsl(var(--primary))]'
const labelCls = 'block text-sm font-medium text-[hsl(var(--foreground))] mb-1'

export default function UserManagementPage() {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const { locales, loading: localesLoading } = useLocals()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')

  const availableRoles = isSuperAdminRole(userRole) ? ROLES : ROLES.filter((r) => r.value !== 'SUPERADMIN')

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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setOk(''); setErr('')
    if (!form.name || !form.email || !form.password) { setErr('Completa nombre, correo y contraseña.'); return }
    if (form.password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres.'); return }
    if (form.role !== 'SUPERADMIN' && !form.local_id) { setErr('Selecciona el local al que pertenece este usuario.'); return }
    setLoading(true)
    try {
      await createUser({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        role: form.role, local_id: form.local_id || null,
      })
      const localName = locales.find((l) => String(l.id) === String(form.local_id))?.name
      setOk(`Usuario "${form.email.trim()}" creado como ${form.role}${localName ? ` en el local "${localName}"` : ''}.`)
      setForm({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
    } catch (e2) {
      setErr(e2.detail || e2.message || 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
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
                <div>
                  <label className={labelCls}>Contraseña</label>
                  <input className={inputCls} type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <label className={labelCls}>Rol</label>
                  <select className={inputCls} value={form.role} onChange={set('role')}>
                    {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {form.role !== 'SUPERADMIN' && (
                <div>
                  <label className={labelCls}>Local asignado</label>
                  <select className={inputCls} value={form.local_id} onChange={set('local_id')} disabled={localesLoading}>
                    <option value="">{localesLoading ? 'Cargando locales…' : '— Selecciona un local —'}</option>
                    {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">El usuario solo tendrá acceso a este local.</p>
                </div>
              )}
              {ok && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {ok} <button type="button" onClick={() => navigate('/usuarios')} className="underline font-medium ml-1">Ver lista</button>
                </div>
              )}
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line">{err}</div>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading}>{loading ? 'Creando…' : 'Crear usuario'}</Button>
                <Button type="button" variant="outline" onClick={() => navigate('/usuarios')}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
