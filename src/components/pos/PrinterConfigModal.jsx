import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Trash2, Wifi, WifiOff, Pencil, X } from 'lucide-react'
import {
  listPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinterConnection,
} from '../../lib/apiClient'
import { toast } from 'sonner'

const EMPTY_FORM = { name: '', model: '', ip_address: '', port: 9100, is_active: true }

export default function PrinterConfigModal({ localId, onClose, open = true }) {
  const [printers, setPrinters] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)

  useEffect(() => {
    fetchPrinters()
  }, [localId])

  async function fetchPrinters() {
    setLoading(true)
    try {
      const data = await listPrinters(localId)
      setPrinters(data || [])
    } catch (err) {
      toast.error('Error al cargar impresoras: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(printer) {
    setEditingId(printer.id)
    setForm({
      name: printer.name,
      model: printer.model || '',
      ip_address: printer.ip_address,
      port: printer.port,
      is_active: printer.is_active,
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.ip_address.trim()) {
      toast.error('Nombre e IP son obligatorios')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updatePrinter(editingId, {
          name: form.name,
          model: form.model || null,
          ip_address: form.ip_address,
          port: Number(form.port),
          is_active: form.is_active,
        })
        toast.success('Impresora actualizada')
      } else {
        await createPrinter({ local_id: localId, ...form, port: Number(form.port) })
        toast.success('Impresora registrada')
      }
      setEditingId(null)
      setForm(EMPTY_FORM)
      await fetchPrinters()
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta impresora?')) return
    try {
      await deletePrinter(id)
      toast.success('Impresora eliminada')
      await fetchPrinters()
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  async function handleTest(printer) {
    setTestingId(printer.id)
    try {
      const res = await testPrinterConnection(printer.id)
      if (res?.ok) {
        toast.success(res.message || 'Conexión exitosa')
      } else {
        toast.error(res?.message || 'Error de conexión')
      }
    } catch (err) {
      toast.error('Error al probar: ' + err.message)
    } finally {
      setTestingId(null)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Printer className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Configuración de Ticketera</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Administra las impresoras de tickets</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4 bg-[hsl(var(--muted)/0.3)] rounded-lg p-4 border border-[hsl(var(--border))]">
            <h3 className="font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
              {editingId ? 'Editar impresora' : 'Agregar impresora'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Ticketera Cocina"
                  className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Modelo</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Ej: EPSON TM-T20III"
                  className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">IP *</label>
                <input
                  type="text"
                  value={form.ip_address}
                  onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                  placeholder="192.168.1.100"
                  className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Puerto *</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                  min={1}
                  max={65535}
                  className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-[hsl(var(--primary))]"
              />
              <label htmlFor="is_active" className="text-sm text-[hsl(var(--foreground))]">
                Impresora activa (se usará por defecto)
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </form>

          {/* Printer list */}
          <div>
            <h3 className="font-medium text-[hsl(var(--foreground))] mb-3">Impresoras registradas</h3>
            {loading ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
            ) : printers.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay impresoras configuradas.</p>
            ) : (
              <ul className="space-y-2">
                {printers.map(p => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[hsl(var(--foreground))]">{p.name}</span>
                        {p.is_active ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Activa</span>
                        ) : (
                          <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full">Inactiva</span>
                        )}
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {p.model ? `${p.model} · ` : ''}{p.ip_address}:{p.port}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testingId === p.id}
                        title="Probar conexión"
                        className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--primary))] disabled:opacity-50"
                      >
                        {testingId === p.id ? <WifiOff className="w-4 h-4 animate-pulse" /> : <Wifi className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        title="Editar"
                        className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        title="Eliminar"
                        className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-[hsl(var(--border))] flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </>
  )
}
