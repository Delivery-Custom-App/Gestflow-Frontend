import { useCallback, useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listarMaquinasDelLocal, maquinasElegibles, requiereCompartir, textoDeOcupacion, maxPorMaquina, webCobraCon,
} from '../../lib/maquinasCobro'

const ETIQUETA = {
  libre: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  compartible: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  llena: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  desactivada: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}

/**
 * Lista de máquinas POS del local para que el vendedor elija con cuál cobrará
 * con tarjeta (restaurante, sección 5b). Muestra quién usa cada una: una libre
 * se toma, una con una persona se comparte ("Compartida con Ana") y una con
 * dos está llena y no se puede elegir.
 *
 * No llama a la API para tomarla: lo hace quien la usa con `onConfirmar`
 * (al abrir el turno, `POST /cajas`; durante el turno, `PUT /cajas/{id}/maquina`).
 * Si eso falla con un 409 (otra persona la tomó, se llenó o la desactivaron),
 * se muestra el motivo del backend y la lista se vuelve a pedir.
 *
 * `maquinaActualId`: la que ya tiene el turno (no se ofrece de nuevo).
 * `onSinMaquina`: si se pasa, permite seguir sin máquina (solo cobros sin tarjeta).
 * `motivoNoElegible(maquina)`: si devuelve un texto, la máquina se muestra pero
 * no se puede elegir (por ejemplo, su caja física no está abierta; #133).
 */
export default function ElegirMaquina({
  localId, maquinaActualId = null, onConfirmar, onSinMaquina = null,
  textoConfirmar = 'Usar esta máquina', textoSinMaquina = 'Seguir sin máquina', motivoNoElegible = null,
}) {
  const [maquinas, setMaquinas] = useState(null) // null = cargando
  const [falloCarga, setFalloCarga] = useState(false)
  const [elegida, setElegida] = useState('')
  const [error, setError] = useState('')
  const [tomando, setTomando] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let ignore = false
    listarMaquinasDelLocal(localId)
      .then((filas) => {
        if (ignore) return
        setMaquinas(filas)
        setFalloCarga(false)
        const elegibles = maquinasElegibles(filas).filter((m) => String(m.id) !== String(maquinaActualId))
        // Con una sola opción no tiene sentido hacer elegir.
        setElegida(elegibles.length === 1 ? String(elegibles[0].id) : '')
      })
      .catch((e) => {
        if (ignore) return
        // No se afirma que no haya máquinas: solo que no se pudieron consultar.
        setMaquinas([])
        setFalloCarga(true)
        setError(e?.message || 'No se pudieron cargar las máquinas de cobro')
      })
    return () => { ignore = true }
  }, [localId, maquinaActualId, intento])

  const recargar = useCallback(() => { setMaquinas(null); setIntento((n) => n + 1) }, [])

  const esActual = (m) => maquinaActualId && String(m.id) === String(maquinaActualId)
  const noElegible = (m) => (motivoNoElegible ? motivoNoElegible(m) : null)
  const elegibles = maquinasElegibles(maquinas).filter((m) => !esActual(m) && !noElegible(m))
  const seleccion = elegibles.find((m) => String(m.id) === elegida) || null

  const confirmar = async () => {
    if (!seleccion) { setError('Elige una máquina'); return }
    setTomando(true)
    setError('')
    try {
      await onConfirmar(seleccion, { compartir: requiereCompartir(seleccion) })
    } catch (e) {
      setTomando(false)
      setError(e?.message || 'No se pudo tomar la máquina')
      // La lista ya no es la misma (otra persona la tomó, se llenó o la desactivaron).
      if (e?.conflicto) recargar()
    }
  }

  if (maquinas === null) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las máquinas de cobro…</p>
  }

  const avisoError = error && (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">{error}</p>
  )
  const sinMaquina = onSinMaquina && (
    <button type="button" onClick={() => onSinMaquina()} disabled={tomando}
      className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40">
      {textoSinMaquina}
    </button>
  )

  if (falloCarga) {
    return (
      <div className="flex flex-col gap-4">
        {avisoError}
        <div className="flex items-center justify-between gap-2 pt-1">
          {sinMaquina || <span />}
          <Button variant="outline" onClick={() => { setError(''); recargar() }}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Elige con qué máquina cobrarás con tarjeta. Una máquina la pueden usar hasta {maxPorMaquina() === 3 ? 'tres' : 'dos'} personas:
        si ya la usa alguien, la compartes. Queda contigo hasta que termines tu turno.
      </p>

      {avisoError}

      {maquinas.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          Tu local no tiene máquinas de cobro registradas. Pídele al encargado que registre una.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Máquinas de cobro">
          {maquinas.map((m) => {
            const actual = esActual(m)
            const bloqueada = actual || !elegibles.includes(m)
            const ocupacion = actual ? 'Tu máquina' : textoDeOcupacion(m)
            return (
              <li key={m.id}>
                <label className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  bloqueada ? 'border-[hsl(var(--border))] opacity-60'
                    : elegida === String(m.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] cursor-pointer'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] cursor-pointer'}`}>
                  <input type="radio" name="maquina-cobro" value={m.id} checked={elegida === String(m.id)}
                    aria-label={`${m.nombre} · ${ocupacion}`}
                    disabled={bloqueada || tomando} onChange={() => { setElegida(String(m.id)); setError('') }} />
                  <CreditCard className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[hsl(var(--foreground))]">{m.nombre}</span>
                    {m.proveedorLabel && <span className="block text-xs text-[hsl(var(--muted-foreground))]">{m.proveedorLabel}</span>}
                    {!actual && noElegible(m) && <span className="block text-xs text-amber-700 dark:text-amber-300">{noElegible(m)}</span>}
                    {!webCobraCon(m.proveedor) && (
                      <span className="block text-xs text-amber-700 dark:text-amber-300">La web todavía no cobra con Haulmer</span>
                    )}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${actual ? ETIQUETA.libre : ETIQUETA[m.estado]}`}>
                    {ocupacion}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {maquinas.length > 0 && elegibles.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          {motivoNoElegible
            ? 'Ninguna máquina se puede usar ahora: están llenas, desactivadas o su caja no está abierta. Pídele ayuda al encargado.'
            : 'Todas las máquinas están llenas o desactivadas. Pídele al encargado que libere una.'}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {sinMaquina || <span />}
        {elegibles.length > 0 && (
          <Button onClick={confirmar} disabled={tomando || !seleccion}>
            {tomando ? 'Tomando…' : requiereCompartir(seleccion) ? 'Compartir esta máquina' : textoConfirmar}
          </Button>
        )}
      </div>
    </div>
  )
}
