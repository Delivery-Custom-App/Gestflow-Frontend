import { useState, useEffect, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Users, Store, Plus, Trash2, X, UserPlus, Loader2, Eye, EyeOff, Shield, HelpCircle, KeyRound, Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdminRole } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'
import { useLocals } from '../hooks/useLocals'
import { listUsers, deleteUser, createUser, getOptionalAuthContext } from '../lib/apiClient'
import { SIN_LOCAL, usuariosVisibles } from '../lib/listaUsuarios'
import {
  AVISO_VENDEDOR, LARGO_MINIMO_CONTRASENA, ROL_LABEL, datosDeAlta, formatearRut, pideRut,
  puedeCrearUsuarios, rolConLocal, rolesAsignables, validarAlta,
} from '../lib/altaUsuario'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate, useParams } from 'react-router'

const FORM_VACIO = { nombre: '', apellido: '', rut: '', email: '', password: '', role: 'EMPLEADO', local_id: '' }

const ORDEN_ROL = { SUPERADMIN: 0, ADMIN_NEGOCIO: 1, ADMIN: 2, EMPLEADO: 3 }

/*
 * ¿Quién ve qué? (el backend ya filtra por permisos en GET /users):
 * - El dueño ve a las personas de todos sus locales, con columna y filtro por
 *   local; dentro de una franquicia (/local/:localId/usuarios), solo las de ese
 *   local, sin salir de ella.
 * - El encargado ve solo a las de su local, y no crea ni elimina: el backend
 *   no le permite crear usuarios (403).
 */

function roleBadge(role) {
  const r = String(role || '').toUpperCase()
  const label = ROL_LABEL[r] || role
  if (r === 'SUPERADMIN') return <Badge>{label}</Badge>
  if (r === 'ADMIN_NEGOCIO') return <Badge>{label}</Badge>
  if (r === 'ADMIN')      return <Badge variant="info">{label}</Badge>
  if (r === 'EMPLEADO')   return <Badge variant="secondary">{label}</Badge>
  return <Badge variant="outline">{label}</Badge>
}

// ── Drawer crear usuario ─────────────────────────────────────────────────────
export function CreateUserDrawer({ isOpen, onClose, onSuccess, locales, localesLoading, userRole, localIdPorDefecto = '' }) {
  // Abierto desde una franquicia, el alta llega con ese local elegido.
  const formInicial = { ...FORM_VACIO, local_id: localIdPorDefecto || '' }
  const [form, setForm]       = useState(formInicial)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const availableRoles = rolesAsignables(userRole)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setRut = (e) => setForm((f) => ({ ...f, rut: formatearRut(e.target.value) }))

  const reset = () => {
    setForm(formInicial)
    setErr('')
    setShowPwd(false)
  }

  const handleClose = () => { if (!loading) { reset(); onClose() } }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    const problema = validarAlta(form)
    if (problema) { setErr(problema); return }
    setLoading(true)
    try {
      const local = locales.find((l) => String(l.id) === String(form.local_id))
      await createUser(datosDeAlta(form, local))
      reset()
      onSuccess()
      onClose()
    } catch (e2) {
      setErr(e2.detail || e2.message || 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div role="presentation"
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: 500 }}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <UserPlus className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nuevo usuario</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Completa los datos del usuario</p>
            </div>
          </div>
          <button aria-label="Cerrar" type="button" onClick={handleClose} disabled={loading} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6 flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-name">Nombre <span className="text-red-500">*</span></Label>
              <Input id="u-name" placeholder="Ej: Juan" value={form.nombre} onChange={set('nombre')} disabled={loading} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-apellido">Apellido</Label>
              <Input id="u-apellido" placeholder="Ej: Pérez" value={form.apellido} onChange={set('apellido')} disabled={loading} />
            </div>
          </div>

          {pideRut() && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-rut">RUT <span className="text-red-500">*</span></Label>
              <Input id="u-rut" placeholder="12.345.678-5" value={form.rut} onChange={setRut} disabled={loading} inputMode="text" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-email">Correo electrónico <span className="text-red-500">*</span></Label>
            <Input id="u-email" type="email" placeholder="Ingrese el correo electrónico" value={form.email} onChange={set('email')} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-pwd">Contraseña <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input id="u-pwd" type={showPwd ? 'text' : 'password'} placeholder={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`} value={form.password} onChange={set('password')} disabled={loading} className="pr-9" />
              <button aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-role">Rol <span className="text-red-500">*</span></Label>
            <select
              id="u-role"
              value={form.role}
              onChange={set('role')}
              disabled={loading}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
            >
              {availableRoles.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
            </select>
          </div>

          {rolConLocal(form.role) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-local">Local asignado <span className="text-red-500">*</span></Label>
              <select
                id="u-local"
                value={form.local_id}
                onChange={set('local_id')}
                disabled={loading || localesLoading}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
              >
                <option value="">{localesLoading ? 'Cargando locales…' : 'Selecciona un Local'}</option>
                {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">El usuario solo tendrá acceso a este local.</p>
            </div>
          )}

          {form.role === 'EMPLEADO' && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-300">
              {AVISO_VENDEDOR}
            </p>
          )}

          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[hsl(var(--border))]">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Creando…</span> : 'Crear usuario'}
          </Button>
        </div>
      </div>
    </>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function UsersListPage() {
  const { userRole, user } = useAuth()
  const navigate = useNavigate()
  const { locales, loading: localesLoading } = useLocals()
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [guideOpen,  setGuideOpen]  = useState(false)
  const [filtroLocal, setFiltroLocal] = useState('')
  // Dentro de una franquicia (/local/:localId/usuarios) la lista es la de ese local.
  const { localId } = useParams()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      let businessId = null
      if (!isSuperAdminRole(userRole)) {
        const ctx = await getOptionalAuthContext()
        businessId = ctx.businessId
      }
      const data = await listUsers(businessId)
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      setErr(e.detail || e.message || 'Error al cargar usuarios')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    if (isInventoryAdminRole(userRole)) loadUsers()
  }, [userRole, loadUsers])

  if (!isInventoryAdminRole(userRole)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(var(--background))]">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <h2 className="text-lg font-bold text-red-600">No autorizado</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">No tienes permisos para ver los usuarios.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/')}>Volver</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const puedeCrear = puedeCrearUsuarios(userRole)

  const canDelete = (targetUser) => {
    // El encargado solo consulta la lista: no crea ni elimina usuarios.
    if (!puedeCrear) return false
    const me = String(user?.id || '')
    const myRole = String(userRole || '').toUpperCase().replace(/[\s_-]+/g, '')
    const targetRole = String(targetUser.role || '').toUpperCase().replace(/[\s_-]+/g, '')
    if (me === String(targetUser.id)) return false
    if (targetRole === 'SUPERADMIN') return false
    if (targetRole === 'ADMINNEGOCIO' && myRole !== 'SUPERADMIN') return false
    if (targetRole === 'ADMIN' && myRole !== 'SUPERADMIN' && myRole !== 'ADMINNEGOCIO') return false
    return myRole === 'SUPERADMIN' || myRole === 'ADMINNEGOCIO' || myRole === 'ADMIN'
  }

  const onDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.email}?`)) return
    try { await deleteUser(u.id); loadUsers() }
    catch (e2) { setErr(e2.detail || e2.message || 'Error al eliminar usuario') }
  }

  const localNameById = Object.fromEntries(locales.map((l) => [String(l.id), l.name]))
  const nombreLocal = (id) => (id ? localNameById[String(id)] || `Local ${String(id).slice(0, 8)}…` : 'Sin local')
  const ordenRol = (u) => ORDEN_ROL[String(u.role || '').toUpperCase()] ?? 99

  // Por local (sin local al final) y, dentro de cada uno, del rol más alto al vendedor.
  const visibles = [...usuariosVisibles(users, { localId, filtroLocal })].sort((a, b) => {
    if (!a.local_id !== !b.local_id) return a.local_id ? -1 : 1
    const porLocal = nombreLocal(a.local_id).localeCompare(nombreLocal(b.local_id))
    return porLocal || ordenRol(a) - ordenRol(b)
  })
  // El filtro solo tiene sentido en la vista de todo el negocio, con más de un local.
  // "Sin local" (el dueño, por ejemplo) es una opción del filtro, pero no cuenta como local.
  const localesConUsuarios = [...new Set(users.map((u) => (u.local_id ? String(u.local_id) : SIN_LOCAL)))]
  const cantidadLocales = localesConUsuarios.filter((id) => id !== SIN_LOCAL).length
  const mostrarFiltro = !localId && cantidadLocales > 1
  const titulo = localId ? `Usuarios de ${nombreLocal(localId)}` : 'Gestión de usuarios'

  return (
    <>
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
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Gestión de Usuarios</h3>
              </div>
              <button type="button" aria-label="Cerrar guía"
                onClick={() => setGuideOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                {
                  icon: Users,
                  color: 'text-[hsl(var(--primary))]',
                  title: 'Lista de usuarios',
                  desc: localId
                    ? 'Muestra a las personas de esta franquicia. Sigues dentro de ella: el menú lateral es el del local.'
                    : 'Muestra a las personas de todas tus franquicias, con el local de cada una.',
                },
                {
                  icon: Shield,
                  color: 'text-violet-600',
                  title: 'Roles',
                  desc: 'Cada usuario tiene un rol: Dueño de negocio (todas sus franquicias), Encargado de local (gestiona su franquicia) o Vendedor (el punto de venta de su local).',
                },
                // El encargado solo consulta la lista de su local: sin filtro ni alta.
                ...(puedeCrear ? [{
                  icon: Filter,
                  color: 'text-[hsl(var(--primary))]',
                  title: 'Filtrar por local',
                  desc: 'En la vista de todo el negocio, el filtro deja ver solo a las personas de una franquicia. Dentro de una franquicia, la lista ya es la de ese local.',
                }] : []),
                ...(puedeCrear ? [{
                  icon: UserPlus,
                  color: 'text-[hsl(var(--primary))]',
                  title: 'Crear usuario',
                  desc: 'Registra un nuevo usuario con su nombre, correo, contraseña, rol y la franquicia a la que pertenece. Dentro de una franquicia, llega con ese local elegido.',
                  highlight: true,
                }] : []),
                {
                  icon: KeyRound,
                  color: 'text-amber-600',
                  title: 'Contraseña',
                  desc: puedeCrear
                    ? `La contraseña se define al crear el usuario. Debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres. Un vendedor la cambia en su primer ingreso; cualquiera puede cambiarla después desde Configuración.`
                    : 'Cada persona cambia su propia contraseña desde Configuración. Las cuentas nuevas las crea el dueño del negocio.',
                },
              ].map(({ icon: Icon, color, title, desc, highlight }) => (
                <div
                  key={title}
                  className={`flex gap-3 rounded-xl p-3 ${
                    highlight
                      ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]'
                      : 'bg-[hsl(var(--muted)/0.4)]'
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${color}`}>
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
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{titulo}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {visibles.length} usuario{visibles.length === 1 ? '' : 's'}
                {!localId && ` · ${cantidadLocales} local${cantidadLocales === 1 ? '' : 'es'}`}
                {localId && puedeCrear && (
                  <>
                    {' · '}
                    <button type="button" onClick={() => navigate('/usuarios')} className="font-medium text-[hsl(var(--primary))] hover:underline">
                      Ver todo el negocio
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {puedeCrear && (
              <Button size="sm" onClick={() => setDrawerOpen(true)}>
                <Plus size={16} /> Crear usuario
              </Button>
            )}
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={13} />
              <span>¿Cómo funciona esta pantalla?</span>
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {mostrarFiltro && (
          <div className="flex items-center gap-2">
            <label htmlFor="usuarios-filtro-local" className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              <Filter size={14} /> Local
            </label>
            <select
              id="usuarios-filtro-local"
              value={filtroLocal}
              onChange={(e) => setFiltroLocal(e.target.value)}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
            >
              <option value="">Todos los locales</option>
              {localesConUsuarios
                .filter((id) => id !== SIN_LOCAL)
                .sort((a, b) => nombreLocal(a).localeCompare(nombreLocal(b)))
                .map((id) => <option key={id} value={id}>{nombreLocal(id)}</option>)}
              {localesConUsuarios.includes(SIN_LOCAL) && <option value={SIN_LOCAL}>Sin local</option>}
            </select>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando usuarios…</p>
        ) : visibles.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">
            {localId ? 'Este local todavía no tiene usuarios.' : 'No hay usuarios.'}
          </CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                    <th className="py-2.5 px-5 font-medium">Nombre</th>
                    <th className="py-2.5 px-5 font-medium">Correo</th>
                    <th className="py-2.5 px-5 font-medium">Rol</th>
                    <th className="py-2.5 px-5 font-medium">Local</th>
                    {puedeCrear && <th className="py-2.5 px-5 font-medium text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((u) => (
                    <tr key={u.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30">
                      <td className="py-2.5 px-5 font-medium text-[hsl(var(--foreground))]">{u.name || '—'}</td>
                      <td className="py-2.5 px-5 text-[hsl(var(--muted-foreground))]">{u.email}</td>
                      <td className="py-2.5 px-5">{roleBadge(u.role)}</td>
                      <td className="py-2.5 px-5 text-[hsl(var(--muted-foreground))]">
                        <span className="inline-flex items-center gap-1.5">
                          {u.local_id
                            ? <Store size={14} className="shrink-0 text-[hsl(var(--primary))]" />
                            : <Shield size={14} className="shrink-0 text-violet-600" />}
                          {nombreLocal(u.local_id)}
                        </span>
                      </td>
                      {puedeCrear && (
                        <td className="py-2.5 px-5 text-right">
                          {canDelete(u) && (
                            <Button variant="danger" size="sm" onClick={() => onDelete(u)}>
                              <Trash2 size={14} /> Eliminar
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {puedeCrear && (
        <CreateUserDrawer
          key={localId || 'negocio'}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSuccess={loadUsers}
          locales={locales}
          localesLoading={localesLoading}
          userRole={userRole}
          localIdPorDefecto={localId}
        />
      )}
    </div>
    </>
  )
}
