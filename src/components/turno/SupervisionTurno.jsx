import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { listCajas } from '../../lib/salesApi'
import { listarMaquinasDelLocal } from '../../lib/maquinasCobro'
import { hoyEnChile } from '../../lib/fondoEmergencia'
import { turnoTerminado } from '../../lib/turnos'
import {
  MOTIVO_MAX, empleadosConTurnoHoy, forzarTermino, liberarMaquina, mensajeSupervision, pideReasignar, validarMotivo,
} from '../../lib/supervision'

const CAMPO = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))]'

function Motivo({ id, valor, onChange, disabled, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Motivo</Label>
      <textarea id={id} rows={2} maxLength={MOTIVO_MAX} value={valor} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder} className={CAMPO} />
    </div>
  )
}

/**
 * Supervisión de un turno abierto (T-42), para el administrador y el dueño:
 * liberar la máquina del turno y terminar el turno a la fuerza (pasando sus
 * mesas abiertas a otro empleado con turno hoy). Siempre con motivo; el
 * empleado recibe un aviso. `usuarios`: las personas del negocio (para los
 * nombres y los destinos).
 */
export default function SupervisionTurno({ turno, usuarios = [], onHecho }) {
  const [accion, setAccion] = useState(null) // 'liberar' | 'terminar'
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState('')
  const [pedirDestino, setPedirDestino] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [maquina, setMaquina] = useState(null)
  const [destinos, setDestinos] = useState([])

  useEffect(() => {
    let ignore = false
    const hoy = hoyEnChile()
    Promise.all([
      turno.pos_machine_id && !turno.pos_machine_released_at ? listarMaquinasDelLocal(turno.local_id).catch(() => []) : [],
      listCajas(turno.local_id, { businessDate: hoy, status: 'open' }).catch(() => []),
    ]).then(([maquinas, abiertas]) => {
      if (ignore) return
      setMaquina(maquinas.find((m) => String(m.id) === String(turno.pos_machine_id)) || null)
      setDestinos(empleadosConTurnoHoy(usuarios, abiertas, { localId: turno.local_id, hoy, excepto: turno.cashier_user_id }))
    })
    return () => { ignore = true }
  }, [turno, usuarios])

  const empezar = (cual) => { setAccion(cual); setMotivo(''); setDestino(''); setPedirDestino(false); setError(''); setAviso('') }

  const confirmar = async (e) => {
    e.preventDefault()
    const problema = validarMotivo(motivo)
    if (problema) { setError(problema); return }
    if (pedirDestino && !destino) { setError('Elige a quién se le pasan las mesas abiertas.'); return }
    setOcupado(true)
    setError('')
    try {
      if (accion === 'liberar') {
        const r = await liberarMaquina(turno.pos_machine_id, motivo)
        const n = Array.isArray(r?.turnos_liberados) ? r.turnos_liberados.length : 0
        setAviso(`Se liberó la máquina. ${n === 1 ? 'Quedó 1 turno' : `Quedaron ${n} turnos`} sin máquina: deberán elegir otra para cobrar con tarjeta.`)
      } else {
        await forzarTermino(turno.id, { motivo, reasignarAUserId: destino || null })
        setAviso('Se terminó el turno. El empleado recibe un aviso con el motivo.')
      }
      setAccion(null)
      onHecho?.()
    } catch (err) {
      if (accion === 'terminar' && pideReasignar(err)) {
        setPedirDestino(true)
        setError(`${mensajeSupervision(err).replace(/ \(reasignar_a_user_id\)$/, '')}.`)
      } else {
        setError(mensajeSupervision(err))
      }
    } finally {
      setOcupado(false)
    }
  }

  const tieneMaquina = Boolean(turno.pos_machine_id && !turno.pos_machine_released_at)
  const terminado = turnoTerminado(turno)

  return (
    <section aria-label="Supervisión del turno" className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Supervisión</h3>
      {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {tieneMaquina && (
        <p className="text-sm text-[hsl(var(--foreground))]">Máquina del turno: <strong>{maquina?.nombre || 'Máquina POS'}</strong></p>
      )}
      {!accion && (
        <div className="flex flex-wrap gap-2">
          {tieneMaquina && <Button size="sm" variant="outline" onClick={() => empezar('liberar')}>Liberar máquina</Button>}
          {!terminado && <Button size="sm" variant="outline" onClick={() => empezar('terminar')}>Terminar este turno</Button>}
          {terminado && <p className="text-xs text-[hsl(var(--muted-foreground))]">Este turno ya terminó: queda contarlo y cerrarlo.</p>}
        </div>
      )}
      {accion && (
        <form onSubmit={confirmar} aria-label={accion === 'liberar' ? 'Liberar máquina' : 'Terminar este turno'} className="flex flex-col gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {accion === 'liberar'
              ? 'Se suelta la máquina de todos los turnos que la usan. Su turno sigue abierto; para cobrar con tarjeta deberán elegir otra.'
              : 'El empleado ya no podrá vender en este turno y su máquina se suelta. La caja queda abierta para contarla y cerrarla.'}
          </p>
          <Motivo id={`motivo-${accion}`} valor={motivo} onChange={setMotivo} disabled={ocupado}
            placeholder={accion === 'liberar' ? 'Ej: El lector quedó sin batería' : 'Ej: Se retiró por una emergencia'} />
          {accion === 'terminar' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reasignar-a">{pedirDestino ? 'Pasar sus mesas abiertas a (obligatorio)' : 'Si tiene mesas abiertas, pasarlas a'}</Label>
              <select id="reasignar-a" value={destino} onChange={(e) => setDestino(e.target.value)} disabled={ocupado} className={CAMPO}>
                <option value="">{destinos.length ? 'Elige un empleado con turno hoy' : 'No hay otro empleado con turno hoy'}</option>
                {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAccion(null)} disabled={ocupado}>Cancelar</Button>
            <Button type="submit" size="sm" variant="danger" disabled={ocupado}>
              {ocupado ? 'Un momento…' : accion === 'liberar' ? 'Liberar' : 'Terminar turno'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
