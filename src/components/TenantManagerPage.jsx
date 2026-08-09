import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Plus, Pencil, Trash2, X, Loader2, Search, History, Power, ShieldAlert, HelpCircle } from 'lucide-react'
import { getAuthContext } from '../lib/apiClient'
import {
  listBusinesses,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  getAuditLog,
} from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatApiErrorDetail } from '../lib/apiClient'

const PLANS = [
  { value: 'starter',     label: 'Standard' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise',  label: 'Enterprise' },
]

const PLAN_BADGE = {
  enterprise:   'bg-violet-100 text-violet-700 border-violet-200',
  professional: 'bg-blue-100 text-blue-700 border-blue-200',
  starter:      'bg-stone-100 text-stone-700 border-stone-200',
}

const PLAN_LABEL = Object.fromEntries(PLANS.map((p) => [p.value, p.label]))

const ACTION_LABEL = {
  'business.create': 'Creación de franquicia',
  'business.update': 'Actualización de franquicia',
  'business.delete': 'Eliminación de franquicia',
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

// ── Drawer crear/editar franquicia ───────────────────────────────────────────
function BusinessDrawer({ isOpen, onClose, onSuccess, editing }) {
  const [form, setForm] = useState({ name: '', rut: '', plan: 'starter', is_active: true })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isOpen) {
      setErr('')
      setForm(
        editing
          ? { name: editing.name || '', rut: editing.rut || '', plan: editing.plan || 'starter', is_active: editing.is_active !== false }
          : { name: '', rut: '', plan: 'starter', is_active: true }
      )
    }
  }, [isOpen, editing])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleClose = () => { if (!loading) onClose() }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) { setErr('El nombre de la franquicia es obligatorio.'); return }
    setLoading(true)
    try {
      if (editing) {
        const body = { name: form.name.trim(), rut: form.rut.trim() || null }
        if (form.plan !== editing.plan) body.plan = form.plan
        if ((form.is_active !== false) !== (editing.is_active !== false)) body.is_active = form.is_active !== false
        await updateBusiness(editing.id, body)
      } else {
        await createBusiness({ name: form.name.trim(), rut: form.rut.trim() || null, plan: form.plan })
      }
      onSuccess()
      onClose()
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al guardar la franquicia')
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
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">{editing ? 'Editar franquicia' : 'Nueva franquicia'}</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{editing ? 'Actualiza los datos del negocio' : 'Registra un nuevo negocio'}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={loading} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-name">Nombre <span className="text-red-500">*</span></Label>
            <Input id="b-name" placeholder="Empresa S.A." value={form.name} onChange={set('name')} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-rut">RUT</Label>
            <Input id="b-rut" placeholder="76.123.456-7" value={form.rut} onChange={set('rut')} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-plan">Plan</Label>
            <select
              id="b-plan"
              value={form.plan}
              onChange={set('plan')}
              disabled={loading}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
            >
              {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {editing && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                disabled={loading}
                className="h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/40"
              />
              <span className="text-sm text-[hsl(var(--foreground))]">Franquicia activa</span>
            </label>
          )}

          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[hsl(var(--border))]">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando…</span> : editing ? 'Actualizar' : 'Crear franquicia'}
          </Button>
        </div>
      </div>
    </>
  )
}

// ── Modal confirmar eliminación ──────────────────────────────────────────────
function ConfirmDeleteModal({ business, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[600] p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <ShieldAlert size={18} />
          </div>
          <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Eliminar franquicia</h3>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          ¿Seguro que quieres eliminar <span className="font-semibold text-[hsl(var(--foreground))]">{business.name}</span>?
          Esta acción eliminará la franquicia y todos sus datos asociados y <span className="font-semibold text-red-600">no se puede deshacer</span>.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Eliminando…</span> : 'Eliminar'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal historial de auditoría ─────────────────────────────────────────────
function AuditModal({ business, onClose }) {
  const [entries, setEntries] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!business) return
    let cancelled = false
    setEntries(null)
    setErr('')
    ;(async () => {
      try {
        const ctx = await getAuthContext()
        const data = await getAuditLog({ businessId: business.id, limit: 200 }, ctx.token)
        if (!cancelled) setEntries(Array.isArray(data) ? data : [])
      } catch (e2) {
        if (!cancelled) setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar la auditoría')
      }
    })()
    return () => { cancelled = true }
  }, [business])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[600] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Auditoría — {business.name}</h3>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-4">
          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{err}</p>}
          {entries === null ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando auditoría…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin eventos registrados.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {entries.map((e, i) => (
                <div key={e.id || i} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      {ACTION_LABEL[e.action] || e.action}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatDateTime(e.created_at)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {e.actor_email || e.actor_user_id || 'Usuario desconocido'}
                    {e.details ? ` · ${JSON.stringify(e.details)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function TenantManagerPage() {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [auditTarget, setAuditTarget] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const data = await listBusinesses(ctx.token)
      setBusinesses(Array.isArray(data) ? data : [])
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar franquicias')
      setBusinesses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (b) => {
    try {
      await updateBusiness(b.id, { is_active: !(b.is_active !== false) })
      load()
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cambiar el estado')
    }
  }

  const onDelete = async () => {
    setDeleting(true)
    try {
      await deleteBusiness(confirmDelete.id)
      setConfirmDelete(null)
      load()
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al eliminar la franquicia')
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? businesses.filter((b) => (b.name || '').toLowerCase().includes(q) || (b.rut || '').toLowerCase().includes(q))
    : businesses

  return (
    <>
      <AnimatePresence>
        {guideOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setGuideOpen(false)}>
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
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Gestor de Negocios</h3>
                </div>
                <button onClick={() => setGuideOpen(false)} className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { title: 'Lista de franquicias', desc: 'Cada franquicia es un negocio con sus propios locales. Aquí las ves todas, con su RUT, plan y estado.' },
                  { title: 'Crear / editar', desc: 'Registra una nueva franquicia con nombre, RUT y plan, o actualiza los datos de una existente.' },
                  { title: 'Activar / desactivar', desc: 'El interruptor de estado permite suspender el acceso de una franquicia sin borrar sus datos.' },
                  { title: 'Auditoría', desc: 'Cada creación, edición o eliminación queda registrada con usuario y fecha.' },
                  { title: 'Eliminar', desc: 'Solo superadministradores. Borra la franquicia y todos sus datos. Es irreversible.', highlight: true },
                ].map(({ title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-red-50 border border-red-200' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
        <div className="p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Gestor de negocios</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {businesses.length} franquicia{businesses.length === 1 ? '' : 's'} registrada{businesses.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button size="sm" onClick={() => { setEditing(null); setDrawerOpen(true) }}>
                <Plus size={16} /> Nueva franquicia
              </Button>
              <button onClick={() => setGuideOpen(true)} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                <HelpCircle size={13} />
                <span>¿Cómo funciona esta pantalla?</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

          {loading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando franquicias…
            </p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">No se encontraron franquicias.</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((b) => (
                <Card key={b.id} className="overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate">{b.name || '—'}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${PLAN_BADGE[b.plan] || PLAN_BADGE.starter}`}>
                          {PLAN_LABEL[b.plan] || b.plan}
                        </span>
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {b.rut || 'Sin RUT'} · Creada {formatDate(b.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(b)}
                        title={b.is_active !== false ? 'Desactivar franquicia' : 'Activar franquicia'}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                      >
                        {b.is_active !== false ? (
                          <><Power size={13} className="text-emerald-600" /><span className="text-emerald-700">Activa</span></>
                        ) : (
                          <><Power size={13} className="text-red-500" /><span className="text-red-600">Inactiva</span></>
                        )}
                      </button>
                      <Button variant="ghost" size="sm" onClick={() => setAuditTarget(b)} title="Ver auditoría">
                        <History size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setDrawerOpen(true) }} title="Editar">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b)} title="Eliminar">
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <BusinessDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSuccess={load}
          editing={editing}
        />
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDeleteModal
            business={confirmDelete}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={onDelete}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {auditTarget && <AuditModal business={auditTarget} onClose={() => setAuditTarget(null)} />}
      </AnimatePresence>
    </>
  )
}
