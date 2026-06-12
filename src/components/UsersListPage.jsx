import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Store, Plus, Trash2, ChevronDown, X, UserPlus, Loader2, Eye, EyeOff, Shield, HelpCircle, KeyRound, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdminRole } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'
import { useLocals } from '../hooks/useLocals'
import { listUsers, deleteUser, createUser, getOptionalAuthContext } from '../lib/apiClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'

// Roles ordenados Superadmin → Admin → Trabajador
const ROLES_SUPERADMIN = [
  { value: 'SUPERADMIN', label: 'Super Administrador' },
  { value: 'ADMIN',      label: 'Administrador' },
  { value: 'EMPLEADO',   label: 'Trabajador' },
]
// Admin solo puede crear Trabajadores
const ROLES_ADMIN = [
  { value: 'EMPLEADO', label: 'Trabajador' },
]

function roleBadge(role) {
  const r = String(role || '').toUpperCase()
  if (r === 'SUPERADMIN') return <Badge>{role}</Badge>
  if (r === 'ADMIN')      return <Badge variant="info">{role}</Badge>
  if (r === 'EMPLEADO')   return <Badge variant="secondary">{role}</Badge>
  return <Badge variant="outline">{role}</Badge>
}

// ── Drawer crear usuario ─────────────────────────────────────────────────────
function CreateUserDrawer({ isOpen, onClose, onSuccess, locales, localesLoading, userRole }) {
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const availableRoles = isSuperAdminRole(userRole) ? ROLES_SUPERADMIN : ROLES_ADMIN
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const reset = () => {
    setForm({ name: '', email: '', password: '', role: 'EMPLEADO', local_id: '' })
    setErr('')
    setShowPwd(false)
  }

  const handleClose = () => { if (!loading) { reset(); onClose() } }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name || !form.email || !form.password) { setErr('Completa nombre, correo y contraseña.'); return }
    if (form.password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres.'); return }
    if (form.role !== 'SUPERADMIN' && !form.local_id) { setErr('Selecciona el local al que pertenece este usuario.'); return }
    setLoading(true)
    try {
      await createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role, local_id: form.local_id || null })
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
      <div
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
          <button type="button" onClick={handleClose} disabled={loading} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-name">Nombre <span className="text-red-500">*</span></Label>
            <Input id="u-name" placeholder="Ingrese el nombre" value={form.name} onChange={set('name')} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-email">Correo electrónico <span className="text-red-500">*</span></Label>
            <Input id="u-email" type="email" placeholder="Ingrese el correo electrónico" value={form.email} onChange={set('email')} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-pwd">Contraseña <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input id="u-pwd" type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} disabled={loading} className="pr-9" />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
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
              {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {form.role !== 'SUPERADMIN' && (
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
  const [openGroups, setOpenGroups] = useState(new Set(['__superadmin__']))

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      let businessId = null
      if (!isSuperAdminRole(userRole)) {
        const ctx = await getOptionalAuthContext()
        businessId = ctx.businessId
      }
      const data = await listUsers(businessId)
      const list = Array.isArray(data) ? data : []
      setUsers(list)
      // Abrir todos los grupos por defecto al cargar
      const ids = new Set(list.map((u) => u.local_id ? String(u.local_id) : '__none__'))
      setOpenGroups(ids)
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

  const canDelete = (targetUser) => {
    const me = String(user?.id || '')
    const myRole = String(userRole || '').toUpperCase()
    const targetRole = String(targetUser.role || '').toUpperCase()
    if (me === String(targetUser.id)) return false
    if (targetRole === 'SUPERADMIN') return false
    if (targetRole === 'ADMIN' && myRole !== 'SUPERADMIN') return false
    return myRole === 'SUPERADMIN' || myRole === 'ADMIN'
  }

  const onDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.email}?`)) return
    try { await deleteUser(u.id); loadUsers() }
    catch (e2) { setErr(e2.detail || e2.message || 'Error al eliminar usuario') }
  }

  const toggleGroup = (lid) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(lid) ? next.delete(lid) : next.add(lid)
      return next
    })
  }

  const ROLE_ORDER = { SUPERADMIN: 0, ADMIN: 1, CAJERO: 2, EMPLEADO: 3 }
  const sortByRole = (a, b) => {
    const ra = ROLE_ORDER[String(a.role || '').toUpperCase()] ?? 99
    const rb = ROLE_ORDER[String(b.role || '').toUpperCase()] ?? 99
    return ra - rb
  }

  const localNameById = Object.fromEntries(locales.map((l) => [String(l.id), l.name]))
  const groupsMap = new Map()
  for (const u of users) {
    const role = String(u.role || '').toUpperCase()
    const lid = role === 'SUPERADMIN' ? '__superadmin__' : u.local_id ? String(u.local_id) : '__none__'
    if (!groupsMap.has(lid)) groupsMap.set(lid, [])
    groupsMap.get(lid).push(u)
  }
  const groups = Array.from(groupsMap.entries())
    .map(([lid, us]) => ({
      localId: lid,
      localName: lid === '__superadmin__' ? 'SuperAdministradores' : lid === '__none__' ? 'Sin local asignado' : (localNameById[lid] || `Local ${lid.slice(0, 8)}…`),
      users: [...us].sort(sortByRole),
    }))
    .sort((a, b) => {
      if (a.localId === '__superadmin__') return -1
      if (b.localId === '__superadmin__') return 1
      if (a.localId === '__none__') return 1
      if (b.localId === '__none__') return -1
      return a.localName.localeCompare(b.localName)
    })

  return (
    <>
    <AnimatePresence>
      {guideOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setGuideOpen(false)}
        >
          <motion.div
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
              <button
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
                  desc: 'Muestra todos los usuarios de tu negocio agrupados por franquicia. Cada grupo se puede abrir o cerrar haciendo clic en el encabezado.',
                },
                {
                  icon: Shield,
                  color: 'text-violet-600',
                  title: 'Roles',
                  desc: 'Cada usuario tiene un rol: Super Administrador (acceso total), Administrador (gestiona su franquicia) o Trabajador (acceso operativo básico).',
                },
                {
                  icon: Building2,
                  color: 'text-[hsl(var(--primary))]',
                  title: 'Grupos por franquicia',
                  desc: 'Los usuarios se organizan automáticamente según la franquicia a la que pertenecen. Los Super Administradores aparecen en su propio grupo.',
                },
                {
                  icon: UserPlus,
                  color: 'text-[hsl(var(--primary))]',
                  title: 'Crear usuario',
                  desc: 'Registra un nuevo usuario asignándole nombre, correo, contraseña, rol y la franquicia a la que pertenece.',
                  highlight: true,
                },
                {
                  icon: KeyRound,
                  color: 'text-amber-600',
                  title: 'Contraseña',
                  desc: 'La contraseña se define al crear el usuario. Debe tener al menos 6 caracteres. El usuario puede cambiarla desde su perfil.',
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
          </motion.div>
        </motion.div>
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
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Gestión de usuarios</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {users.length} usuario{users.length === 1 ? '' : 's'} · {groups.length} grupo{groups.length === 1 ? '' : 's'} por local
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus size={16} /> Crear usuario
            </Button>
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

        {/* Lista acordeón */}
        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando usuarios…</p>
        ) : users.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">No hay usuarios.</CardContent></Card>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => {
              const isOpen = openGroups.has(g.localId)
              return (
                <Card key={g.localId} className="overflow-hidden">
                  {/* Cabecera clickeable */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.localId)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-[hsl(var(--muted))]/40 hover:bg-[hsl(var(--muted))]/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {g.localId === '__superadmin__'
                        ? <Shield size={17} className="text-violet-600 shrink-0" />
                        : <Store size={17} className="text-[hsl(var(--primary))] shrink-0" />
                      }
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{g.localName}</span>
                      <Badge variant="secondary">{g.users.length}</Badge>
                    </div>
                    <ChevronDown
                      size={17}
                      className={`text-[hsl(var(--muted-foreground))] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Contenido expandible */}
                  {isOpen && (
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                            <th className="py-2 px-5 font-medium">Nombre</th>
                            <th className="py-2 px-5 font-medium">Correo</th>
                            <th className="py-2 px-5 font-medium">Rol</th>
                            <th className="py-2 px-5 font-medium text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.users.map((u) => (
                            <tr key={u.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30">
                              <td className="py-2.5 px-5 font-medium text-[hsl(var(--foreground))]">{u.name || '—'}</td>
                              <td className="py-2.5 px-5 text-[hsl(var(--muted-foreground))]">{u.email}</td>
                              <td className="py-2.5 px-5">{roleBadge(u.role)}</td>
                              <td className="py-2.5 px-5 text-right">
                                {canDelete(u) && (
                                  <Button variant="danger" size="sm" onClick={() => onDelete(u)}>
                                    <Trash2 size={14} /> Eliminar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <CreateUserDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={loadUsers}
        locales={locales}
        localesLoading={localesLoading}
        userRole={userRole}
      />
    </div>
    </>
  )
}
