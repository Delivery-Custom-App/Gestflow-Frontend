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
import { errorDeMotivo, liberarGrupo, MOTIVO_MAX, nombresEnLista } from '../../lib/liberarGrupo'
import { formatCLPDisplay } from '../../lib/formatCLP'

const estadoDeMesa = (mesa) => {
  if (!mesa.ocupada) return 'libre'
  return mesa.conPedido ? `pedido abierto · ${formatCLPDisplay(mesa.total)}` : 'ocupada, sin pedido'
}

/**
 * «Liberar grupo» (encargado y dueño): suelta todas las mesas ocupadas del
 * grupo con un motivo y separa el grupo. Avisa antes qué mesas tienen un pedido
 * abierto y cuánto quedaría sin cobrar. Si una mesa no se puede liberar, se
 * sigue con las demás y al final se dice cuáles fallaron.
 *
 * `mesas` es lo de `estadoDelGrupo`; `onDone(resultado)` se llama al cerrar la
 * ventana de resultado, para que la vista de mesas se refresque.
 */
export default function LiberarGrupoModal({ grupo, mesas, onClose, onDone }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const ocupadas = mesas.filter((m) => m.ocupada)
  const conPedido = ocupadas.filter((m) => m.conPedido)
  const totalSinCobrar = conPedido.reduce((suma, m) => suma + m.total, 0)
  // Con todas las mesas libres no hay nada que liberar: solo se separa y no hace falta motivo.
  const soloSeparar = ocupadas.length === 0
  const problemaDeMotivo = soloSeparar ? null : errorDeMotivo(motivo)
  const motivoEscrito = motivo.trim() !== ''

  const handleClose = () => {
    if (guardando) return
    if (resultado) onDone(resultado)
    else onClose()
  }

  const confirmar = async (event) => {
    event.preventDefault()
    if (problemaDeMotivo) {
      setError(problemaDeMotivo)
      return
    }
    setGuardando(true)
    setError('')
    try {
      setResultado(await liberarGrupo({ grupoId: grupo.id, mesas, motivo }))
    } catch (err) {
      setError(err?.message || 'No se pudo liberar el grupo.')
    } finally {
      setGuardando(false)
    }
  }

  const titulo = !resultado ? 'Liberar grupo' : resultado.separado ? 'Grupo liberado' : 'Faltó liberar mesas'

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {resultado
              ? `${grupo.etiqueta}: ${resultado.liberadas.length} mesa${resultado.liberadas.length === 1 ? '' : 's'} liberada${resultado.liberadas.length === 1 ? '' : 's'}.`
              : `Se liberan las mesas ocupadas de ${grupo.etiqueta} y después se separa el grupo.`}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3 px-6 py-4">
            {resultado.separado && (
              <p role="status" className="text-sm text-green-700">
                {resultado.liberadas.length > 0
                  ? `${nombresEnLista(resultado.liberadas)} ${resultado.liberadas.length === 1 ? 'quedó libre' : 'quedaron libres'} y el grupo se separó.`
                  : 'El grupo se separó.'}
              </p>
            )}
            {resultado.sinCobrar > 0 && (
              <p className="text-sm text-[hsl(var(--foreground))]">
                Total que quedó sin cobrar: <strong>{formatCLPDisplay(resultado.sinCobrar)}</strong>
              </p>
            )}
            {resultado.fallidas.length > 0 && (
              <div role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">No se pudieron liberar:</p>
                <ul className="space-y-0.5">
                  {resultado.fallidas.map((m) => <li key={m.id}>{m.nombre}: {m.mensaje}</li>)}
                </ul>
                <p className="text-xs">El grupo sigue junto. Libera esas mesas y vuelve a intentarlo.</p>
              </div>
            )}
            {resultado.errorAlSeparar && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Las mesas quedaron libres, pero no se pudo separar el grupo: {resultado.errorAlSeparar}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={confirmar} noValidate className="space-y-4 px-6 py-4">
            <ul aria-label="Mesas del grupo" className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] text-sm">
              {mesas.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium">{m.nombre}</span>
                  <span className={m.conPedido ? 'font-semibold text-amber-700' : 'text-[hsl(var(--muted-foreground))]'}>{estadoDeMesa(m)}</span>
                </li>
              ))}
            </ul>

            {conPedido.length > 0 && (
              <div role="note" aria-label="Pedidos abiertos que quedarán sin cobrar" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">
                  {conPedido.length === 1
                    ? `${conPedido[0].nombre} tiene un pedido abierto.`
                    : `${nombresEnLista(conPedido)} tienen pedidos abiertos.`}
                </p>
                <p>Al liberar quedan sin cobrar (sin ingreso). Total que quedaría sin cobrar: <strong>{formatCLPDisplay(totalSinCobrar)}</strong></p>
              </div>
            )}

            {soloSeparar ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Todas las mesas ya están libres: solo se separa el grupo.</p>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="motivo-liberar-grupo" className="text-sm font-medium">Motivo</label>
                <textarea
                  id="motivo-liberar-grupo"
                  value={motivo}
                  onChange={(event) => { setMotivo(event.target.value); setError('') }}
                  maxLength={MOTIVO_MAX}
                  rows={3}
                  disabled={guardando}
                  aria-invalid={motivoEscrito && Boolean(problemaDeMotivo)}
                  aria-describedby="motivo-liberar-grupo-ayuda"
                  placeholder="Ej: Los clientes se retiraron"
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                />
                <div className="flex items-start justify-between gap-3 text-xs">
                  <p id="motivo-liberar-grupo-ayuda" className={motivoEscrito && problemaDeMotivo ? 'text-red-600' : 'text-[hsl(var(--muted-foreground))]'}>
                    {motivoEscrito && problemaDeMotivo ? problemaDeMotivo : 'Entre 3 y 300 caracteres.'}
                  </p>
                  <span className="text-[hsl(var(--muted-foreground))]">{motivo.length}/{MOTIVO_MAX}</span>
                </div>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <DialogFooter className="-mx-6 -mb-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={guardando || Boolean(problemaDeMotivo)}>
                {guardando ? 'Liberando…' : soloSeparar ? 'Separar grupo' : 'Liberar grupo'}
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
