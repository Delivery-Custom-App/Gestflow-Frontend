import { useState } from 'react'
import { Clock3, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { terminarTurno } from '../../lib/salesApi'
import { horaDe } from '../../lib/registroTurnos'
import { mensajeTerminarTurno } from '../../lib/turnos'

/**
 * El dueño o el encargado que vende en un local al paso, con su turno abierto
 * (#141): cuándo empezó y «Terminar mi turno» (`POST /cajas/{id}/terminar-turno`),
 * como la barra del vendedor. Terminarlo hace falta para cerrar la caja.
 */
export default function MiTurnoDeVenta({ turno, onTerminado }) {
  const [confirmando, setConfirmando] = useState(false)
  const [terminando, setTerminando] = useState(false)
  const [error, setError] = useState('')
  const desde = horaDe(turno?.opened_at)

  const terminar = async () => {
    setTerminando(true)
    setError('')
    try {
      await terminarTurno(turno.id)
      setConfirmando(false)
      onTerminado?.()
    } catch (err) {
      setError(mensajeTerminarTurno(err))
    } finally {
      setTerminando(false)
    }
  }

  return (
    <div role="region" aria-label="Tu turno de venta" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Clock3 size={14} /> Vendes en tu turno{desde ? ` desde las ${desde}` : ''}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => { setConfirmando(true); setError('') }}>
        <LogOut size={13} /> Terminar mi turno
      </Button>
      {confirmando && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto && !terminando) setConfirmando(false) }}>
          <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="w-[calc(100%-2rem)] flex max-h-[90vh] max-w-md flex-col">
            <DialogHeader>
              <DialogTitle>¿Terminar tu turno?</DialogTitle>
              <DialogDescription>Ya no podrás vender en este turno. La caja sigue abierta hasta que la cierres en Caja y turnos.</DialogDescription>
            </DialogHeader>
            {error && (
              <DialogBody>
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              </DialogBody>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmando(false)} disabled={terminando}>Cancelar</Button>
              <Button type="button" onClick={terminar} disabled={terminando}>{terminando ? 'Terminando…' : 'Terminar mi turno'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
