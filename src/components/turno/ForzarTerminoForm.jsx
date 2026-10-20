import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MOTIVO_MAX, forzarTermino, mensajeSupervision, pideReasignar, validarMotivo } from '../../lib/supervision'

export const CAMPO = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))]'

export function Motivo({ id, valor, onChange, disabled, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Motivo</Label>
      <textarea id={id} rows={2} maxLength={MOTIVO_MAX} value={valor} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder} className={CAMPO} />
    </div>
  )
}

/**
 * Terminar un turno a la fuerza (T-42, T-54): el motivo es obligatorio y, si el
 * turno tiene mesas abiertas, hay que elegir a quién pasarlas (el backend
 * responde 409 sin destino y entonces se pide). `destinos` son los empleados
 * con turno abierto hoy que pueden recibirlas. `onHecho` recibe el aviso que se
 * le muestra a quien lo hizo.
 */
export default function ForzarTerminoForm({
  turnoId, destinos = [], onHecho, onCancelar, titulo = 'Terminar este turno', textoBoton = 'Terminar turno',
}) {
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState('')
  const [pedirDestino, setPedirDestino] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // T-54: cerrar también todas sus sesiones, con el mismo motivo.
  const [cerrarSesion, setCerrarSesion] = useState(false)
  const id = `terminar-${turnoId}`

  const confirmar = async (e) => {
    e.preventDefault()
    const problema = validarMotivo(motivo)
    if (problema) { setError(problema); return }
    if (pedirDestino && !destino) { setError('Elige a quién se le pasan las mesas abiertas.'); return }
    setOcupado(true)
    setError('')
    try {
      await forzarTermino(turnoId, { motivo, reasignarAUserId: destino || null, cerrarSesion })
      onHecho?.(cerrarSesion
        ? 'Se terminó el turno y se cerraron sus sesiones. El empleado recibe un aviso con el motivo.'
        : 'Se terminó el turno. El empleado recibe un aviso con el motivo.')
    } catch (err) {
      if (pideReasignar(err)) {
        setPedirDestino(true)
        setError(`${mensajeSupervision(err).replace(/ \(reasignar_a_user_id\)$/, '')}.`)
      } else {
        setError(mensajeSupervision(err))
      }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={confirmar} aria-label={titulo} className="flex flex-col gap-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        El empleado ya no podrá vender en este turno y su máquina se suelta. La caja queda abierta para contarla y cerrarla.
      </p>
      <Motivo id={`motivo-${id}`} valor={motivo} onChange={setMotivo} disabled={ocupado} placeholder="Ej: Se retiró por una emergencia" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reasignar-${id}`}>{pedirDestino ? 'Pasar sus mesas abiertas a (obligatorio)' : 'Si tiene mesas abiertas, pasarlas a'}</Label>
        <select id={`reasignar-${id}`} value={destino} onChange={(e) => setDestino(e.target.value)} disabled={ocupado} className={CAMPO}>
          <option value="">{destinos.length ? 'Elige un empleado con turno hoy' : 'No hay otro empleado con turno hoy'}</option>
          {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm text-[hsl(var(--foreground))]">
        <input type="checkbox" checked={cerrarSesion} onChange={(e) => setCerrarSesion(e.target.checked)} disabled={ocupado} className="mt-0.5" />
        <span>
          Cerrar también su sesión
          <span className="block text-xs text-[hsl(var(--muted-foreground))]">Se cierran todas sus sesiones abiertas con el mismo motivo: tendrá que volver a iniciar sesión.</span>
        </span>
      </label>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
        <Button type="submit" size="sm" variant="danger" disabled={ocupado}>{ocupado ? 'Un momento…' : textoBoton}</Button>
      </div>
    </form>
  )
}
