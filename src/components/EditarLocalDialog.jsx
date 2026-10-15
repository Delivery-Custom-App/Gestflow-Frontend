import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TELEFONO_MAX, actualizarLocal, mensajeLocal, validarTelefono } from '../lib/localsApi'

/**
 * Editar el nombre y el teléfono de un local (T-38). El teléfono se guarda
 * tal como se escribe; vaciarlo lo borra.
 */
export default function EditarLocalDialog({ local, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(local.name || '')
  const [telefono, setTelefono] = useState(local.phone || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    const problema = validarTelefono(telefono)
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await actualizarLocal(local.id, { name: nombre, phone: telefono })
      onGuardado?.()
    } catch (err) {
      setError(mensajeLocal(err))
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar local</DialogTitle>
          <DialogDescription>{local.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-local-nombre">Nombre</Label>
            <Input id="editar-local-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardando} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-local-telefono">Teléfono</Label>
            <Input id="editar-local-telefono" type="tel" maxLength={TELEFONO_MAX} value={telefono} placeholder="Ej: 9 1234 5678"
              onChange={(e) => setTelefono(e.target.value)} disabled={guardando} />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Se guarda tal como lo escribes. Vacío lo borra.</p>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
