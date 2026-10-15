import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { liberarMesa } from '../../lib/salesApi'
import { formatCLPDisplay } from '../../lib/formatCLP'

export default function LiberarMesaModal({ mesa, totalPendiente, onClose, onDone }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const motivoLimpio = motivo.trim()
  const motivoValido = motivoLimpio.length >= 3 && motivoLimpio.length <= 300

  const handleClose = () => {
    if (guardando) return
    if (resultado) onDone(resultado)
    else onClose()
  }

  const confirmar = async (event) => {
    event.preventDefault()
    if (!motivoValido) {
      setError('El motivo debe tener entre 3 y 300 caracteres.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      setResultado(await liberarMesa(mesa.id, motivoLimpio))
    } catch (err) {
      setError(err?.detail ? `${err.status ? `${err.status}: ` : ''}${err.detail}` : err?.message || 'No se pudo liberar la mesa.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resultado ? 'Mesa liberada' : 'Liberar mesa'}</DialogTitle>
          <DialogDescription>
            {resultado
              ? `${resultado.nombre || mesa.name} quedó disponible.`
              : `Los pedidos abiertos de ${mesa.name} se cancelarán sin cobrar.`}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3 px-6 py-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Total sin cobrar</p>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {formatCLPDisplay(resultado.total_sin_cobrar ?? 0)}
            </p>
            <p role="status" className="text-sm text-green-700">La mesa está disponible.</p>
          </div>
        ) : (
          <form onSubmit={confirmar} className="space-y-4 px-6 py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Total actual que quedaría sin cobrar: <strong>{formatCLPDisplay(totalPendiente)}</strong>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="motivo-liberar-mesa" className="text-sm font-medium">Motivo</label>
              <textarea
                id="motivo-liberar-mesa"
                value={motivo}
                onChange={(event) => { setMotivo(event.target.value); setError('') }}
                minLength={3}
                maxLength={300}
                required
                rows={3}
                disabled={guardando}
                placeholder="Ej: Los clientes se retiraron sin pagar"
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              />
              <p className="text-right text-xs text-[hsl(var(--muted-foreground))]">{motivo.length}/300</p>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <DialogFooter className="-mx-6 -mb-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={guardando || !motivoValido}>
                {guardando ? 'Liberando…' : 'Liberar mesa'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {resultado && (
          <DialogFooter>
            <Button type="button" onClick={() => onDone(resultado)}>Volver a mesas</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
