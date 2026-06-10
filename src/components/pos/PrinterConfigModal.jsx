import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Plus, Trash2, Wifi, WifiOff, Pencil, X } from 'lucide-react'
import {
  listPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinterConnection,
} from '../../lib/apiClient'
import { toast } from 'sonner'

const EMPTY_FORM = { name: '', model: '', ip_address: '', port: 9100, is_active: true }

export default function PrinterConfigModal({ localId, onClose }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold dark:text-white">Configuración de Ticketera</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 dark:text-gray-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {editingId ? 'Editar impresora' : 'Agregar impresora'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Ticketera Cocina"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Ej: EPSON TM-T20III"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  IP *
                </label>
                <input
                  type="text"
                  value={form.ip_address}
                  onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                  placeholder="192.168.1.100"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Puerto *
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                  min={1}
                  max={65535}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm text-gray-600 dark:text-gray-300">
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
            <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">
              Impresoras registradas
            </h3>
            {loading ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : printers.length === 0 ? (
              <p className="text-sm text-gray-400">No hay impresoras configuradas.</p>
            ) : (
              <ul className="space-y-2">
                {printers.map(p => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm dark:text-white">{p.name}</span>
                        {p.is_active ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activa</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {p.model ? `${p.model} · ` : ''}{p.ip_address}:{p.port}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testingId === p.id}
                        title="Probar conexión"
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-500 disabled:opacity-50"
                      >
                        {testingId === p.id ? <WifiOff className="w-4 h-4 animate-pulse" /> : <Wifi className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        title="Editar"
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        title="Eliminar"
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
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
        <div className="px-6 py-3 border-t dark:border-gray-700 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}
