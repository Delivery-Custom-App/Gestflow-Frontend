import { useState, useEffect, useCallback } from 'react'
import { Users, Loader2, Search } from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import { listAllUsers, listBusinesses } from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ROLE_BADGE = {
  SUPERADMIN: 'bg-violet-100 text-violet-700 border-violet-200',
  ADMIN_NEGOCIO: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  CAJERO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EMPLEADO: 'bg-stone-100 text-stone-700 border-stone-200',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [businessId, setBusinessId] = useState('')
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const data = await listAllUsers({ role: role || undefined, businessId: businessId || undefined }, ctx.token)
      setUsers(Array.isArray(data) ? data : [])
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar usuarios')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [role, businessId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ctx = await getAuthContext()
        const data = await listBusinesses(ctx.token)
        if (!cancelled) setBusinesses(Array.isArray(data) ? data : [])
      } catch { /* non-fatal */ }
    })()
    return () => { cancelled = true }
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.business_name || '').toLowerCase().includes(q))
    : users

  const isOwnerOrAdmin = (u) => ['ADMIN_NEGOCIO', 'ADMIN', 'SUPERADMIN'].includes(String(u.role || '').toUpperCase())
  const admins = filtered.filter((u) => isOwnerOrAdmin(u))
  const others = filtered.filter((u) => !isOwnerOrAdmin(u))

  const renderRows = (rows) =>
    rows.length === 0 ? (
      <tr>
        <td colSpan="5" className="py-6 text-center text-[hsl(var(--muted-foreground))]">Sin usuarios.</td>
      </tr>
    ) : (
      rows.map((u) => (
        <tr key={u.id} className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
          <td className="py-2.5 pr-3">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{u.name || '—'}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{u.email}</p>
          </td>
          <td className="py-2.5 pr-3 text-sm text-[hsl(var(--foreground))]">{u.business_name || '—'}</td>
          <td className="py-2.5 pr-3">
            <Badge className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${ROLE_BADGE[String(u.role || '').toUpperCase()] || ROLE_BADGE.EMPLEADO}`}>
              {u.role || '—'}
            </Badge>
          </td>
          <td className="py-2.5 pr-3">
            {u.is_active === false ? (
              <span className="text-xs font-medium text-red-600">Inactivo</span>
            ) : (
              <span className="text-xs font-medium text-emerald-700">Activo</span>
            )}
          </td>
          <td className="py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(u.created_at)}</td>
        </tr>
      ))
    )

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Usuarios</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {filtered.length} usuario{filtered.length === 1 ? '' : 's'} en todas las franquicias
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Buscar por email, nombre o franquicia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full sm:w-60 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          >
            <option value="">Todas las franquicias</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full sm:w-48 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          >
            <option value="">Todos los roles</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
            <option value="ADMIN_NEGOCIO">ADMIN_NEGOCIO</option>
            <option value="ADMIN">ADMIN</option>
            <option value="CAJERO">CAJERO</option>
            <option value="EMPLEADO">EMPLEADO</option>
          </select>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando usuarios…
          </p>
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-2">Administradores ({admins.length})</h3>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                        <th className="pb-2 pr-3 font-medium">Usuario</th>
                        <th className="pb-2 pr-3 font-medium">Franquicia</th>
                        <th className="pb-2 pr-3 font-medium">Rol</th>
                        <th className="pb-2 pr-3 font-medium">Estado</th>
                        <th className="pb-2 font-medium">Creado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">{renderRows(admins)}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-2">Cajeros y empleados ({others.length})</h3>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                        <th className="pb-2 pr-3 font-medium">Usuario</th>
                        <th className="pb-2 pr-3 font-medium">Franquicia</th>
                        <th className="pb-2 pr-3 font-medium">Rol</th>
                        <th className="pb-2 pr-3 font-medium">Estado</th>
                        <th className="pb-2 font-medium">Creado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">{renderRows(others)}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
