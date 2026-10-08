import { useMemo, useState } from 'react'
import { ArrowRightLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { traspasarMesas } from '../../lib/atencionMesas'

const SIN_REGISTRAR = '__sin_registrar__'
const CAMPO = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)]'

/**
 * Traspasar las mesas en curso de un vendedor a otro, todas juntas o una por
 * una. `mesas`: la atención de cada mesa en curso (atencionDeMesa), con su
 * nombre; `vendedores`: a quiénes se les puede pasar; `nombre(id)`: cómo
 * mostrar a cada persona.
 */
export default function TraspasarMesasModal({ mesas, vendedores, nombre, onClose, onDone }) {
  const origenes = useMemo(() => {
    const cuenta = new Map()
    for (const m of mesas) {
      const id = m.atiendeId || SIN_REGISTRAR
      cuenta.set(id, (cuenta.get(id) || 0) + 1)
    }
    return [...cuenta.entries()]
      .map(([id, n]) => ({ id, n, nombre: id === SIN_REGISTRAR ? 'Sin vendedor registrado' : nombre(id) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [mesas, nombre])

  const [deId, setDeId] = useState(origenes.length === 1 ? origenes[0].id : '')
  const delOrigen = mesas.filter((m) => (m.atiendeId || SIN_REGISTRAR) === deId)
  const [elegidas, setElegidas] = useState(() => new Set(delOrigen.map((m) => String(m.mesa.id))))
  const [aId, setAId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const elegirOrigen = (id) => {
    setDeId(id)
    setError('')
    // Por defecto van todas las mesas de esa persona; se pueden desmarcar.
    setElegidas(new Set(mesas.filter((m) => (m.atiendeId || SIN_REGISTRAR) === id).map((m) => String(m.mesa.id))))
    if (aId === id) setAId('')
  }

  const alternar = (mesaId) => setElegidas((prev) => {
    const next = new Set(prev)
    if (next.has(mesaId)) next.delete(mesaId)
    else next.add(mesaId)
    return next
  })

  const aTraspasar = delOrigen.filter((m) => elegidas.has(String(m.mesa.id)))
  const destinos = vendedores.filter((v) => v.id !== deId)

  const traspasar = async () => {
    setGuardando(true)
    setError('')
    const fallidas = await traspasarMesas(aTraspasar, aId)
    setGuardando(false)
    if (fallidas.length) {
      setError(`No se pudieron traspasar: ${fallidas.map((f) => `${f.mesa.mesa.name} (${f.error})`).join(', ')}`)
      return
    }
    onDone?.({ cantidad: aTraspasar.length, a: nombre(aId) })
  }

  return (
    <div className="fixed inset-0 z-50">
      <div role="presentation" className="absolute inset-0 bg-black/60" onClick={() => !guardando && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="traspasar-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <ArrowRightLeft size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 id="traspasar-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">Traspasar mesas</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Cuando un vendedor no puede seguir atendiendo</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={guardando}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          {origenes.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay mesas en curso para traspasar.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="traspaso-de" className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">De</label>
                <select id="traspaso-de" value={deId} onChange={(e) => elegirOrigen(e.target.value)} className={CAMPO} disabled={guardando}>
                  <option value="">Elige quién atiende hoy las mesas</option>
                  {origenes.map((o) => <option key={o.id} value={o.id}>{o.nombre} ({o.n} mesa{o.n === 1 ? '' : 's'})</option>)}
                </select>
              </div>

              {deId && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Mesas (todas, o desmarca las que se quedan)</legend>
                  {delOrigen.map((m) => {
                    const id = String(m.mesa.id)
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <input type="checkbox" checked={elegidas.has(id)} onChange={() => alternar(id)} disabled={guardando} />
                        <span className="flex-1 font-medium text-[hsl(var(--foreground))]">{m.mesa.name}</span>
                        {m.mesa.total != null && <span className="text-xs text-[hsl(var(--muted-foreground))]">${Number(m.mesa.total).toLocaleString('es-CL')}</span>}
                      </label>
                    )
                  })}
                </fieldset>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="traspaso-a" className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">A</label>
                <select id="traspaso-a" value={aId} onChange={(e) => setAId(e.target.value)} className={CAMPO} disabled={guardando || !deId}>
                  <option value="">Elige el vendedor que las recibe</option>
                  {destinos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
                {deId && destinos.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No hay otro vendedor en este local.</p>
                )}
              </div>

              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                Quien las recibe puede agregar productos y cobrarlas. Lo cobrado sigue sumando al turno donde se abrió
                cada mesa, y ese turno no se puede cerrar mientras tenga mesas en curso.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={traspasar} disabled={guardando || !aId || aTraspasar.length === 0}>
            {guardando ? 'Traspasando…' : `Traspasar ${aTraspasar.length} mesa${aTraspasar.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
