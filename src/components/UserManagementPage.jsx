import { useState } from 'react'
import { useNavigate } from 'react-router'
import { UserPlus, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'
import { createUser } from '../lib/apiClient'
import {
  AVISO_VENDEDOR, LARGO_MINIMO_CONTRASENA, ROL_LABEL, datosDeAlta, formatearRut, pideRut,
  puedeCrearUsuarios, rolConLocal, rolesAsignables, validarAlta,
} from '../lib/altaUsuario'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const ROL_DESCRIPCION = {
  EMPLEADO:      'el punto de venta de su local',
  ADMIN:         'su local (inventario, ventas, caja)',
  ADMIN_NEGOCIO: 'todas sus franquicias',
  SUPERADMIN:    'acceso total',
}

const FORM_VACIO = { nombre: '', apellido: '', rut: '', email: '', password: '', role: 'EMPLEADO', local_id: '' }

const HIGH_ROLES = new Set(['ADMIN', 'ADMIN_NEGOCIO', 'SUPERADMIN'])

const ROLE_WARNING = {
  ADMIN:      'Este usuario podrá administrar el inventario, las ventas y la caja de su local.',
  ADMIN_NEGOCIO: 'Este usuario será el dueño de la franquicia y podrá crear sub-administradores y ver toda su red.',
  SUPERADMIN: 'Este usuario tendrá acceso total al sistema, incluyendo todos los locales y configuraciones críticas.',
}

const inputCls =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm text-[hsl(var(--foreground))] ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 focus:border-[hsl(var(--primary))]'
const labelCls = 'block text-sm font-medium text-[hsl(var(--foreground))] mb-1'

function generatePassword() {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  const randomValues = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(randomValues, (v) => chars[v % chars.length]).join('')
}

export default function UserManagementPage() {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const { locales, loading: localesLoading } = useLocals()
  const [form, setForm] = useState(FORM_VACIO)
  const [showPassword, setShowPassword] = useState(false)
  const [roleConfirmed, setRoleConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')

  // Del vendedor al más alto, como se ofrecían antes.
  const availableRoles = [...rolesAsignables(userRole)].reverse()
  const needsConfirm = HIGH_ROLES.has(form.role)

  // En el backend solo el superadmin y el dueño crean usuarios.
  if (!puedeCrearUsuarios(userRole)) {
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
    const val = k === 'rut' ? formatearRut(e.target.value) : e.target.value
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
    const problema = validarAlta(form)
    if (problema) { setErr(problema); return }
    if (needsConfirm && !roleConfirmed) { setErr('Debes confirmar la asignación de este rol antes de continuar.'); return }
    setLoading(true)
    try {
      const local = locales.find((l) => String(l.id) === String(form.local_id))
      await createUser(datosDeAlta(form, local))
      const localName = rolConLocal(form.role) ? local?.name : null
      setOk(`Usuario "${form.email.trim()}" creado como ${ROL_LABEL[form.role]}${localName ? ` en "${localName}"` : ''}.`)
      setForm(FORM_VACIO)
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
                  <label htmlFor="user-management-page-nombre" className={labelCls}>Nombre</label>
                  <input id="user-management-page-nombre" className={inputCls} value={form.nombre} onChange={set('nombre')} placeholder="Juan" />
                </div>
                <div>
                  <label htmlFor="user-management-page-apellido" className={labelCls}>Apellido</label>
                  <input id="user-management-page-apellido" className={inputCls} value={form.apellido} onChange={set('apellido')} placeholder="Pérez" />
                </div>
                {pideRut() && (
                  <div>
                    <label htmlFor="user-management-page-rut" className={labelCls}>RUT</label>
                    <input id="user-management-page-rut" className={inputCls} value={form.rut} onChange={set('rut')} placeholder="12.345.678-5" />
                  </div>
                )}
                <div>
                  <label htmlFor="user-management-page-correo" className={labelCls}>Correo</label>
                  <input id="user-management-page-correo" className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="juan@correo.com" />
                </div>

                {/* Contraseña con generador */}
                <div className="sm:col-span-2">
                  <label htmlFor="user-management-page-contrasena" className={labelCls}>Contraseña</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="user-management-page-contrasena"
                        className={inputCls + ' pr-10'}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={set('password')}
                        placeholder={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`}
                      />
                      <button aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                  <label htmlFor="user-management-page-rol" className={labelCls}>Rol</label>
                  <select id="user-management-page-rol" className={inputCls} value={form.role} onChange={set('role')}>
                    {availableRoles.map((r) => <option key={r} value={r}>{`${ROL_LABEL[r]} — ${ROL_DESCRIPCION[r]}`}</option>)}
                  </select>
                </div>
              </div>

              {rolConLocal(form.role) && (
                <div>
                  <label htmlFor="user-management-page-local-asignado" className={labelCls}>Local asignado</label>
                  <select id="user-management-page-local-asignado" className={inputCls} value={form.local_id} onChange={set('local_id')} disabled={localesLoading}>
                    <option value="">{localesLoading ? 'Cargando locales…' : '— Selecciona un local —'}</option>
                    {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">El usuario solo tendrá acceso a este local.</p>
                </div>
              )}

              {form.role === 'EMPLEADO' && (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{AVISO_VENDEDOR}</p>
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
                    <span className="font-semibold">Confirmo la asignación del rol {ROL_LABEL[form.role]}. </span>
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
