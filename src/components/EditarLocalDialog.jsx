import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TELEFONO_MAX, actualizarLocal, guardarUbicacionLocal, mensajeLocal, validarTelefono } from '../lib/localsApi'
import { geocodeAddress } from '../lib/geocoding'

/**
 * Editar el nombre, el teléfono y la dirección de un local (T-38). El teléfono
 * se guarda tal como se escribe; vaciarlo lo borra. La dirección (calle,
 * comuna y región) se ubica en el mapa al guardar: no hay que escribir
 * coordenadas.
 */
export default function EditarLocalDialog({ local, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(local.name || '')
  const [telefono, setTelefono] = useState(local.phone || '')
  const [calle, setCalle] = useState(local.street_name || '')
  const [comuna, setComuna] = useState(local.city_name || '')
  const [region, setRegion] = useState(local.state_name || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    const problema = validarTelefono(telefono)
    if (problema) { setError(problema); return }
    const direccion = { calle: calle.trim(), comuna: comuna.trim(), region: region.trim() }
    const cambioDireccion = direccion.calle !== (local.street_name || '') || direccion.comuna !== (local.city_name || '') || direccion.region !== (local.state_name || '')
    if (cambioDireccion && !(direccion.calle && direccion.comuna && direccion.region)) {
      setError('Para guardar la dirección completa la calle, la comuna y la región.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (cambioDireccion) {
        const punto = await geocodeAddress(`${direccion.calle}, ${direccion.comuna}, ${direccion.region}`)
        if (!punto) {
          setError('No pudimos ubicar esa dirección en el mapa. Revisa la calle y la comuna.')
          setGuardando(false)
          return
        }
        await guardarUbicacionLocal(local.id, {
          street_name: direccion.calle, city_name: direccion.comuna, state_name: direccion.region,
          latitude: punto.lat, longitude: punto.lng,
        })
      }
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
        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 py-5">
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
          <fieldset className="flex flex-col gap-3" disabled={guardando}>
            <legend className="mb-1 text-sm font-medium">Dirección</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-local-calle">Calle y número</Label>
              <Input id="editar-local-calle" value={calle} placeholder="Ej: Veinte Norte 1234" onChange={(e) => setCalle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editar-local-comuna">Comuna</Label>
                <Input id="editar-local-comuna" value={comuna} placeholder="Ej: Viña del Mar" onChange={(e) => setComuna(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editar-local-region">Región</Label>
                <Input id="editar-local-region" value={region} placeholder="Ej: Valparaíso" onChange={(e) => setRegion(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Mercado Pago la pide para crear la sucursal del local. Se ubica sola en el mapa.</p>
          </fieldset>
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
