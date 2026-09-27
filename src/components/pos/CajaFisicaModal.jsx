import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearCajaFisica, renombrarCajaFisica } from '../../lib/administrativeApi'

/**
 * Alta y renombrado de cajas físicas.
 *
 * El backend tenía el CRUD desde siempre y la web nunca lo usó: sin caja física
 * no hay dónde abrir turno ni qué vincular a MercadoPago. El nombre es único por
 * local, y esa regla la impone el servidor con un 409 — acá se muestra tal cual
 * para que el usuario sepa qué corregir.
 */
export default function CajaFisicaModal({ localId, cajaFisica, onClose, onSaved }) {
  const esRenombrar = Boolean(cajaFisica)
  const [nombre, setNombre] = useState(cajaFisica?.name || cajaFisica?.nombre || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (esRenombrar) {
        await renombrarCajaFisica(cajaFisica.id, limpio)
      } else {
        await crearCajaFisica(localId, limpio)
      }
      onSaved()
      onClose()
    } catch (err) {
      const mensaje = String(err?.message || err?.detail || '')
      // 409: el backend ya explica el conflicto de nombre; se muestra su texto.
      setError(mensaje.includes('409') || /ya existe/i.test(mensaje)
        ? 'Ya existe una caja física con ese nombre en este local. Elige otro.'
        : mensaje || 'No se pudo guardar la caja física.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {esRenombrar ? 'Renombrar caja física' : 'Nueva caja física'}
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {esRenombrar
                ? 'El nombre debe ser único dentro del local.'
                : 'El mueble donde está el hardware. Sobre ella se abren los turnos y se vincula la terminal.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={guardando}
            className="text-xl leading-none text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="caja-fisica-nombre">Nombre</Label>
            <Input
              id="caja-fisica-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Caja principal"
              maxLength={100}
              disabled={guardando}
              autoFocus
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={guardando} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={guardando} className="flex-1">
              {guardando ? 'Guardando…' : esRenombrar ? 'Guardar nombre' : 'Crear caja física'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
