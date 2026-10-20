import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listCajas } from '../../lib/salesApi'
import { listarMaquinasDelLocal } from '../../lib/maquinasCobro'
import { hoyEnChile } from '../../lib/fondoEmergencia'
import { turnoTerminado } from '../../lib/turnos'
import { empleadosConTurnoHoy, liberarMaquina, mensajeSupervision, validarMotivo } from '../../lib/supervision'
import ForzarTerminoForm, { Motivo } from './ForzarTerminoForm'

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

  const empezar = (cual) => { setAccion(cual); setMotivo(''); setError(''); setAviso('') }

  const liberar = async (e) => {
    e.preventDefault()
    const problema = validarMotivo(motivo)
    if (problema) { setError(problema); return }
    setOcupado(true)
    setError('')
    try {
      const r = await liberarMaquina(turno.pos_machine_id, motivo)
      const n = Array.isArray(r?.turnos_liberados) ? r.turnos_liberados.length : 0
      setAviso(`Se liberó la máquina. ${n === 1 ? 'Quedó 1 turno' : `Quedaron ${n} turnos`} sin máquina: deberán elegir otra para cobrar con tarjeta.`)
      setAccion(null)
      onHecho?.()
    } catch (err) {
      setError(mensajeSupervision(err))
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
      {accion === 'liberar' && (
        <form onSubmit={liberar} aria-label="Liberar máquina" className="flex flex-col gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Se suelta la máquina de todos los turnos que la usan. Su turno sigue abierto; para cobrar con tarjeta deberán elegir otra.
          </p>
          <Motivo id="motivo-liberar" valor={motivo} onChange={setMotivo} disabled={ocupado} placeholder="Ej: El lector quedó sin batería" />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAccion(null)} disabled={ocupado}>Cancelar</Button>
            <Button type="submit" size="sm" variant="danger" disabled={ocupado}>{ocupado ? 'Un momento…' : 'Liberar'}</Button>
          </div>
        </form>
      )}
      {accion === 'terminar' && (
        <ForzarTerminoForm
          turnoId={turno.id}
          destinos={destinos}
          onCancelar={() => setAccion(null)}
          onHecho={(texto) => { setAviso(texto); setAccion(null); onHecho?.() }}
        />
      )}
    </section>
  )
}
