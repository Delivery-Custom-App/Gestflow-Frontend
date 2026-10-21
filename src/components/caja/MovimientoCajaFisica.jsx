import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { montoDesdeTexto } from '../../lib/fondoEmergencia'
import { mensajeCajaFisica, registrarMovimientoCajaFisica, validarMovimientoCajaFisica } from '../../lib/cajaFisica'

const CAMPO = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm'

/**
 * Ingreso o retiro del cajón de una caja física abierta (#133). Se anota en su
 * apertura y mueve el cuadre del cierre. Es plata del cajón, así que siempre es
 * efectivo. La caja no tiene gastos: los gastos del local salen del fondo de
 * emergencia.
 */
export default function MovimientoCajaFisica({ caja, onClose, onRegistrado }) {
  const [tipo, setTipo] = useState('egreso')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    const valor = montoDesdeTexto(monto)
    const problema = validarMovimientoCajaFisica({ tipo, monto: valor, note: nota })
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await registrarMovimientoCajaFisica(caja.id, { tipo, monto: valor, note: nota })
      onRegistrado?.({ tipo, monto: valor })
    } catch (err) {
      setError(mensajeCajaFisica(err, 'No se pudo registrar'))
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="w-[calc(100%-2rem)] flex max-h-[90vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Retiro o ingreso de caja</DialogTitle>
          <DialogDescription>{caja?.name || 'Caja física'}. Los gastos del local salen del fondo de emergencia, no de la caja.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movcf-tipo">Tipo</Label>
            <select id="movcf-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={guardando} className={CAMPO}>
              <option value="egreso">Retiro (sale plata del cajón)</option>
              <option value="ingreso">Ingreso (entra plata que no es una venta)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movcf-monto">Monto</Label>
            <input id="movcf-monto" inputMode="numeric" autoComplete="off" value={monto} onChange={(e) => setMonto(e.target.value)} disabled={guardando} placeholder="Ej: 20000" className={CAMPO} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movcf-nota">{tipo === 'egreso' ? 'A dónde fue la plata' : 'Nota (opcional)'}</Label>
            <input id="movcf-nota" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} disabled={guardando}
              placeholder={tipo === 'egreso' ? 'Ej: Depósito en el banco' : 'Ej: Sencillo del banco'} className={CAMPO} />
          </div>
          </DialogBody>
          {error && <p role="alert" className="mx-6 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
