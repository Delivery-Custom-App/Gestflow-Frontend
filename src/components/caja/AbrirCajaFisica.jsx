import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import ConteoEfectivo from '../turno/ConteoEfectivo'
import { totalesDelConteo } from '../../lib/efectivo'
import { diferenciaDe, textoDiferencia } from '../../lib/arqueo'
import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { abrirCajaFisica, faltaNota, mensajeCajaFisica, ultimoCierreDe } from '../../lib/cajaFisica'

const NOTA_MAXIMA = 300

/**
 * Abrir una caja física (#133): el encargado o el dueño cuenta los billetes y
 * monedas del fondo, siempre. Se compara con lo que dejó el último cierre de
 * esa caja; si no coincide, la nota es obligatoria (el backend responde 422 sin
 * ella). La primera apertura de una caja no tiene con qué comparar.
 */
export default function AbrirCajaFisica({ caja, localNombre = '', nombreDe = null, onClose, onAbierta }) {
  const [cantidades, setCantidades] = useState({})
  const [nota, setNota] = useState('')
  const [confirmarSinEfectivo, setConfirmarSinEfectivo] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { total } = totalesDelConteo(cantidades)
  const ultimo = ultimoCierreDe(caja)
  const diferencia = ultimo ? diferenciaDe(total, ultimo.contado) : null
  const pideNota = diferencia !== null && diferencia !== 0
  const notaLimpia = nota.trim()

  const cambiarConteo = (nuevas) => {
    setCantidades(nuevas)
    setConfirmarSinEfectivo(false)
  }

  const abrir = async () => {
    setGuardando(true)
    setError('')
    try {
      const apertura = await abrirCajaFisica(caja.id, { cantidades, nota })
      onAbierta?.(apertura)
    } catch (err) {
      setError(mensajeCajaFisica(err, 'No se pudo abrir la caja'))
      if (faltaNota(err)) document.getElementById('apertura-nota')?.focus()
      setGuardando(false)
    }
  }

  const enviar = (e) => {
    e.preventDefault()
    if (pideNota && notaLimpia.length === 0) {
      setError('Lo contado no coincide con el último cierre: explica la diferencia en la nota.')
      return
    }
    if (total === 0 && !confirmarSinEfectivo) { setError(''); setConfirmarSinEfectivo(true); return }
    abrir()
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="w-[calc(100%-2rem)] flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            {[localNombre, caja?.name || 'Caja física'].filter(Boolean).join(' · ')}. Cuenta los billetes y monedas con que parte la caja.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
          {ultimo ? (
            <div role="note" aria-label="Último cierre de la caja" className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs">
              <p className="text-[hsl(var(--foreground))]">
                Al cerrar la caja el {fechaHora(ultimo.cerradaAt)}{ultimo.cerro ? `, ${nombreDe ? nombreDe(null, ultimo.cerro) : ultimo.cerro} contó ` : ' se contaron '}
                <strong data-testid="ultimo-cierre">{formatMoney(ultimo.contado)}</strong>.
              </p>
              <p data-testid="apertura-vs-cierre" className={cn('font-semibold',
                diferencia < 0 ? 'text-red-600' : diferencia > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                {diferencia === 0 ? 'Coincide con el último cierre' : `${textoDiferencia(diferencia)} respecto del último cierre`}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Es la primera apertura de esta caja: no hay un cierre anterior con qué comparar.</p>
          )}

          <ConteoEfectivo cantidades={cantidades} onChange={cambiarConteo} disabled={guardando} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apertura-nota">{pideNota ? 'Nota (obligatoria: explica la diferencia)' : 'Nota (opcional)'}</Label>
            <textarea id="apertura-nota" rows={2} maxLength={NOTA_MAXIMA} value={nota} onChange={(e) => setNota(e.target.value)} disabled={guardando}
              placeholder="Ej: Se depositó en el banco"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm" />
          </div>

          </DialogBody>
          {/* Fuera del cuerpo con scroll: siempre a la vista, junto a los botones. */}
          {error && <p role="alert" className="mx-6 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {confirmarSinEfectivo ? (
            <div role="alertdialog" aria-labelledby="abrir-sin-efectivo" className="mx-6 mb-5 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/30">
              <p id="abrir-sin-efectivo" className="text-sm font-semibold text-[hsl(var(--foreground))]">¿Abrir la caja sin efectivo?</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No anotaste billetes ni monedas: la caja parte en $0.</p>
              {/* «Volver a contar» queda donde estaba «Abrir caja»: un doble clic no confirma sin querer. */}
              <div className="flex justify-end gap-2">
                <Button type="submit" variant="outline" disabled={guardando}>{guardando ? 'Abriendo…' : 'Sí, abrir sin efectivo'}</Button>
                <Button type="button" onClick={() => setConfirmarSinEfectivo(false)} disabled={guardando}>Volver a contar</Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Abriendo…' : 'Abrir caja'}</Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
