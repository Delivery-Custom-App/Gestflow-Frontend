import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarMaquinasDelLocal, textoDeOcupacion } from '../../lib/maquinasCobro'
import { asignarCajaAMaquina, mensajeCajaFisica } from '../../lib/cajaFisica'

const CAMPO = 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm'

/**
 * Qué máquina POS va en qué caja física (#133 y #140). Toda máquina pertenece a
 * una caja: quien la usa queda en esa caja y ahí busca el vuelto. Una máquina
 * sin caja no se puede elegir para un turno. Solo se ofrecen las cajas activas
 * (el backend responde 400 con una desactivada).
 */
export default function MaquinasDeLasCajas({ localId, cajasFisicas = [], puedeGestionar = false }) {
  const [maquinas, setMaquinas] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState('')
  const [version, setVersion] = useState(0)
  const activas = (Array.isArray(cajasFisicas) ? cajasFisicas : []).filter((c) => c.is_active !== false)
  const nombreDe = useMemo(
    () => new Map((Array.isArray(cajasFisicas) ? cajasFisicas : []).map((c) => [String(c.id), c.name || 'Caja física'])),
    [cajasFisicas],
  )

  useEffect(() => {
    let ignore = false
    listarMaquinasDelLocal(localId)
      .then((filas) => { if (!ignore) { setMaquinas(filas); setError('') } })
      .catch((err) => { if (!ignore) { setMaquinas([]); setError(mensajeCajaFisica(err, 'No se pudieron cargar las máquinas')) } })
    return () => { ignore = true }
  }, [localId, version])

  const asignar = useCallback(async (maquina, cajaId) => {
    setGuardando(maquina.id)
    setError('')
    setAviso('')
    try {
      await asignarCajaAMaquina(maquina.id, cajaId || null)
      setAviso(cajaId ? `${maquina.nombre} quedó en ${nombreDe.get(String(cajaId)) || 'la caja'}.` : `${maquina.nombre} quedó sin caja.`)
      setVersion((v) => v + 1)
    } catch (err) {
      setError(mensajeCajaFisica(err, 'No se pudo asignar la caja'))
    } finally {
      setGuardando('')
    }
  }, [nombreDe])

  if (maquinas === null) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las máquinas…</p>

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {maquinas.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local no tiene máquinas POS registradas.</p>
      ) : (
        <ul aria-label="Máquinas POS del local" className="flex flex-col gap-2">
          {maquinas.map((m) => {
            const sinCaja = !m.cajaFisicaId
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[hsl(var(--foreground))]">{m.nombre}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {sinCaja ? 'Sin caja: no se puede elegir para un turno' : `En ${nombreDe.get(String(m.cajaFisicaId)) || 'una caja'}`} · {textoDeOcupacion(m)}
                  </p>
                </div>
                {puedeGestionar && (
                  <label className="flex items-center gap-2 text-xs">
                    <span className="sr-only">{`Caja de ${m.nombre}`}</span>
                    <select aria-label={`Caja de ${m.nombre}`} value={m.cajaFisicaId || ''} disabled={guardando === m.id}
                      onChange={(e) => asignar(m, e.target.value)} className={CAMPO}>
                      <option value="">Sin caja</option>
                      {activas.map((c) => <option key={c.id} value={c.id}>{c.name || 'Caja física'}</option>)}
                    </select>
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
