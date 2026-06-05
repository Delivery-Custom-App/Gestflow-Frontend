import { useCallback, useEffect, useState } from 'react'
import { getSupplierDetailForBusiness, patchSupplier } from '../../lib/providersApi'
import { formatCLPDisplay as fmt } from '../../lib/formatCLP'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Pencil, X, Check } from 'lucide-react'
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from '@/components/ui/table'

/* ─── helpers ─────────────────────────────────────────────── */
const str  = (v) => (v != null ? String(v).trim() : '') || '—'
const date = (v) => {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return String(v) }
}
const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'
const fieldCls = 'flex flex-col gap-1'
const labelCls = 'text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]'
const valCls   = 'text-sm font-medium text-[hsl(var(--foreground))]'

/* ─── sección datos del proveedor ─────────────────────────── */
function InfoSection({ detail, supplierId, businessId, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')

  useEffect(() => {
    setName(detail.name         ?? '')
    setPhone(detail.phone       ?? '')
    setEmail(detail.email       ?? '')
    setAddress(detail.address   ?? '')
    setContact(detail.contact_name ?? '')
  }, [detail])

  const openEdit = () => { setErr(''); setEditing(true) }
  const cancel   = () => {
    setName(detail.name ?? ''); setPhone(detail.phone ?? '')
    setEmail(detail.email ?? ''); setAddress(detail.address ?? '')
    setContact(detail.contact_name ?? '')
    setErr(''); setEditing(false)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr('')
    try {
      const updated = await patchSupplier(supplierId, businessId, {
        name: name.trim(), phone: phone.trim(),
        email: email.trim(), address: address.trim(), contact_name: contact.trim(),
      })
      onUpdated(updated)
      setEditing(false)
    } catch (e) { setErr(e?.message || 'Error al guardar.') }
    finally { setSaving(false) }
  }

  const ROW = ({ label, value }) => (
    <div className={fieldCls}>
      <span className={labelCls}>{label}</span>
      <span className={valCls}>{value}</span>
    </div>
  )

  if (!editing) return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Datos del proveedor
        </span>
        <button
          onClick={openEdit}
          className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] font-medium hover:underline"
        >
          <Pencil size={12} /> Editar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <ROW label="Nombre"             value={str(detail.name)} />
        <ROW label="RUT"                value={str(detail.rut)} />
        <ROW label="Teléfono"          value={str(detail.phone)} />
        <ROW label="Correo electrónico" value={str(detail.email)} />
        <ROW label="Contacto"           value={str(detail.contact_name)} />
        <ROW label="Categoría"          value={str(detail.category)} />
        <ROW label="Dirección"          value={str(detail.address)} />
        <ROW label="Inicio servicios"   value={date(detail.start_date)} />
        <ROW label="Fecha ingreso"      value={date(detail.created_at)} />
      </div>
    </div>
  )

  return (
    <form onSubmit={save} className="rounded-xl border border-[hsl(var(--primary)/0.4)] p-5 flex flex-col gap-4 bg-[hsl(var(--primary)/0.02)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
          Editando datos
        </span>
        <button type="button" onClick={cancel} disabled={saving}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1">
          <X size={12} /> Cancelar
        </button>
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div className={fieldCls}>
          <Label className={labelCls}>Nombre *</Label>
          <input className={inputCls} value={name}    onChange={e => setName(e.target.value)}    placeholder="Nombre comercial" />
        </div>
        <div className={fieldCls}>
          <Label className={labelCls}>Teléfono</Label>
          <input className={inputCls} value={phone}   onChange={e => setPhone(e.target.value)}   placeholder="+56 9 XXXXXXXX" />
        </div>
        <div className={fieldCls}>
          <Label className={labelCls}>Correo electrónico</Label>
          <input className={inputCls} type="email" value={email}   onChange={e => setEmail(e.target.value)}   placeholder="correo@proveedor.cl" />
        </div>
        <div className={fieldCls}>
          <Label className={labelCls}>Contacto</Label>
          <input className={inputCls} value={contact} onChange={e => setContact(e.target.value)} placeholder="Nombre del contacto" />
        </div>
      </div>
      <div className={fieldCls}>
        <Label className={labelCls}>Dirección</Label>
        <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección completa" />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Guardando…' : <><Check size={13} className="mr-1" />Guardar</>}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/* ─── sección condiciones comerciales ─────────────────────── */
function CommercialSection({ supplierId, businessId, detail, onUpdated }) {
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)
  const [terms,  setTerms]  = useState(detail.payment_terms_days != null ? String(detail.payment_terms_days) : '')
  const [lead,   setLead]   = useState(detail.delivery_lead_time_days != null ? String(detail.delivery_lead_time_days) : '')
  const [notes,  setNotes]  = useState(detail.commercial_notes ?? '')

  const save = async (e) => {
    e.preventDefault(); setErr(''); setSaving(true); setOk(false)
    try {
      const body = { commercial_notes: notes.trim() || null }
      if (terms.trim()) { const n = parseInt(terms,10); if(!Number.isFinite(n)||n<0) throw new Error('Plazo inválido'); body.payment_terms_days = n } else body.payment_terms_days = null
      if (lead.trim())  { const n = parseInt(lead,10);  if(!Number.isFinite(n)||n<0) throw new Error('Plazo inválido'); body.delivery_lead_time_days = n } else body.delivery_lead_time_days = null
      const updated = await patchSupplier(supplierId, businessId, body)
      onUpdated(updated); setOk(true); setTimeout(() => setOk(false), 3000)
    } catch(e) { setErr(e?.message || 'Error al guardar.') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-[hsl(var(--border))] p-5 flex flex-col gap-4">
      <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        Condiciones comerciales
      </span>
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}
      {ok  && <p className="text-xs text-emerald-600">✓ Guardado correctamente</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className={fieldCls}>
          <Label className={labelCls}>Plazo de pago (días)</Label>
          <input className={inputCls} type="number" min="0" value={terms} onChange={e=>setTerms(e.target.value)} placeholder="Ej. 30" />
        </div>
        <div className={fieldCls}>
          <Label className={labelCls}>Plazo de entrega (días)</Label>
          <input className={inputCls} type="number" min="0" value={lead} onChange={e=>setLead(e.target.value)} placeholder="Ej. 3" />
        </div>
      </div>
      <div className={fieldCls}>
        <Label className={labelCls}>Observaciones</Label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Notas o condiciones"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
      </div>
      <Button type="submit" size="sm" disabled={saving} className="self-start">
        {saving ? 'Guardando…' : 'Guardar condiciones'}
      </Button>
    </form>
  )
}

/* ─── modal principal ─────────────────────────────────────── */
function SupplierDetailModal({ open, supplierId, businessId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [detail,  setDetail]  = useState(null)

  const load = useCallback(async () => {
    if (!supplierId || !businessId) return
    setError(''); setLoading(true); setDetail(null)
    try {
      const data = await getSupplierDetailForBusiness(supplierId, businessId)
      setDetail(data && typeof data === 'object' ? data : null)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el proveedor.')
    } finally { setLoading(false) }
  }, [supplierId, businessId])

  useEffect(() => {
    if (!open || !supplierId || !businessId) { setDetail(null); setError(''); return }
    load()
  }, [open, supplierId, businessId, load])

  if (!open || !supplierId || !businessId) return null

  const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []
  const handleUpdated = (updated) => setDetail(prev => prev ? { ...prev, ...updated } : updated)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 880px)' }}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base">
              {detail ? str(detail.name) : 'Proveedor'}
            </DialogTitle>
            {detail && (
              <Badge variant={detail.is_active === false ? 'destructive' : 'success'}>
                {detail.is_active === false ? 'Inactivo' : 'Activo'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-5">

          {loading && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando…</p>
          )}
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</p>
          )}

          {!loading && !error && detail && (
            <>
              {/* Datos del proveedor */}
              <InfoSection
                detail={detail}
                supplierId={supplierId}
                businessId={businessId}
                onUpdated={handleUpdated}
              />

              {/* Condiciones comerciales */}
              <CommercialSection
                supplierId={supplierId}
                businessId={businessId}
                detail={detail}
                onUpdated={handleUpdated}
              />

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Productos asociados', detail.purchased_products_count ?? 0, false],
                  ['Total compras (CLP)', fmt(detail.supplier_purchases_total_clp), true],
                ].map(([label, val, money]) => (
                  <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${money ? 'text-[hsl(var(--primary))]' : ''}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Productos */}
              {products.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                    Productos en inventario
                  </p>
                  <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Costo unit.</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => (
                          <TableRow key={String(p.product_id)}>
                            <TableCell className="font-medium">{str(p.name)}</TableCell>
                            <TableCell className="text-right">{p.quantity ?? 0}</TableCell>
                            <TableCell className="text-right">{fmt(p.unit_price_clp)}</TableCell>
                            <TableCell className="text-right">{fmt(p.line_total_clp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SupplierDetailModal
