import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Store, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSuperAdminRole } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'
import { useLocals } from '../hooks/useLocals'
import { listUsers, deleteUser, getOptionalAuthContext } from '../lib/apiClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function roleBadge(role) {
  const r = String(role || '').toUpperCase()
  if (r === 'SUPERADMIN') return <Badge>{role}</Badge>
  if (r === 'ADMIN') return <Badge variant="info">{role}</Badge>
  if (r === 'EMPLEADO') return <Badge variant="secondary">{role}</Badge>
  return <Badge variant="outline">{role}</Badge>
}

export default function UsersListPage() {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const { locales } = useLocals()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

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

  const onDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.email}?`)) return
    try { await deleteUser(u.id); loadUsers() }
    catch (e2) { setErr(e2.detail || e2.message || 'Error al eliminar usuario') }
  }

  const localNameById = Object.fromEntries(locales.map((l) => [String(l.id), l.name]))
  const groupsMap = new Map()
  for (const u of users) {
    const lid = u.local_id ? String(u.local_id) : '__none__'
    if (!groupsMap.has(lid)) groupsMap.set(lid, [])
    groupsMap.get(lid).push(u)
  }
  const groups = Array.from(groupsMap.entries())
    .map(([lid, us]) => ({
      localId: lid,
      localName: lid === '__none__' ? 'Sin local asignado' : (localNameById[lid] || `Local ${lid.slice(0, 8)}…`),
      users: us,
    }))
    .sort((a, b) => a.localName.localeCompare(b.localName))

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-6">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadUsers}><RefreshCw size={16} /> Actualizar</Button>
            <Button size="sm" onClick={() => navigate('/usuarios/crear')}><Plus size={16} /> Crear usuario</Button>
          </div>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando usuarios…</p>
        ) : users.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">No hay usuarios.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {groups.map((g) => (
              <Card key={g.localId} className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between bg-[hsl(var(--muted))]/40 py-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store size={18} className="text-[hsl(var(--primary))]" />
                    {g.localName}
                  </CardTitle>
                  <Badge variant="secondary">{g.users.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                        <th className="py-2 px-4 font-medium">Nombre</th>
                        <th className="py-2 px-4 font-medium">Correo</th>
                        <th className="py-2 px-4 font-medium">Rol</th>
                        <th className="py-2 px-4 font-medium text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.users.map((u) => (
                        <tr key={u.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30">
                          <td className="py-2.5 px-4 font-medium text-[hsl(var(--foreground))]">{u.name || '—'}</td>
                          <td className="py-2.5 px-4 text-[hsl(var(--muted-foreground))]">{u.email}</td>
                          <td className="py-2.5 px-4">{roleBadge(u.role)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <Button variant="danger" size="sm" onClick={() => onDelete(u)}>
                              <Trash2 size={14} /> Eliminar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
