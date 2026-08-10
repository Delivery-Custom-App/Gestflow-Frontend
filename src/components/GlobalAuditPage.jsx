import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { History, Loader2, Search } from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import { getAuditLog, listBusinesses } from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const ACTION_LABEL = {
  'business.create': 'Creación de franquicia',
  'business.update': 'Actualización de franquicia',
  'business.delete': 'Eliminación de franquicia',
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GlobalAuditPage() {
  const [entries, setEntries] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [businessId, setBusinessId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const data = await getAuditLog({ businessId: businessId || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }, ctx.token)
      setEntries(Array.isArray(data) ? data : [])
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar la auditoría')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [businessId, page])

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
    ? (entries || []).filter((e) =>
        (e.actor_email || '').toLowerCase().includes(q) ||
        (e.target_label || '').toLowerCase().includes(q) ||
        (e.action || '').toLowerCase().includes(q))
    : (entries || [])

  const businessName = businesses.find((b) => String(b.id) === String(businessId))?.name

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Auditoría global</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {businessName ? `Eventos de ${businessName}` : 'Todas las acciones de administración del sistema'}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Buscar por usuario, franquicia o acción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={businessId}
            onChange={(e) => { setBusinessId(e.target.value); setPage(0) }}
            className="w-full sm:w-64 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
          >
            <option value="">Todas las franquicias</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando auditoría…
          </p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">Sin eventos registrados.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {filtered.map((e, i) => (
                  <motion.div
                    key={e.id || i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                    className="py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {ACTION_LABEL[e.action] || e.action}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatDateTime(e.created_at)}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {e.actor_email || e.actor_user_id || 'Usuario desconocido'}
                      {e.target_label ? ` · ${e.target_label}` : ''}
                      {e.details ? ` · ${JSON.stringify(e.details)}` : ''}
                    </p>
                  </motion.div>
                ))}
              </div>

              {(entries || []).length === PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--border))] mt-4">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    Anterior
                  </Button>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Página {page + 1}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
