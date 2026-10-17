import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { turnosSinTerminar } from '../../lib/cierreCaja'
import { hoyEnChile } from '../../lib/fondoEmergencia'
import { horaDe } from '../../lib/registroTurnos'
import { empleadosConTurnoHoy } from '../../lib/supervision'
import ForzarTerminoForm from './ForzarTerminoForm'

/**
 * Quién sigue trabajando al cerrar (T-55): los turnos abiertos de esta caja
 * física que no terminaron, cada uno con «Forzar término» (T-42). No impide
 * cerrar: cerrar un turno termina ese turno, pero los de los demás siguen
 * abiertos, y por eso se avisa antes.
 *
 * `abiertas` son los turnos abiertos del local (también dan los destinos para
 * pasar las mesas abiertas del que se termina), `turnoId` el que se está
 * cerrando y `onTerminado` avisa que cambió algo, para recargar el cierre.
 */
export default function TrabajadoresSinTerminar({
  abiertas = [], cajaFisicaId, localId, turnoId, usuarios = [], nombreDeUsuario = null, onTerminado,
}) {
  const [forzando, setForzando] = useState(null) // id del turno con el formulario abierto
  const [aviso, setAviso] = useState('')
  const sinTerminar = turnosSinTerminar(abiertas, { cajaFisicaId, localId })
  if (sinTerminar.length === 0 && !aviso) return null

  const nombre = (id) => (nombreDeUsuario ? nombreDeUsuario(id) : `Usuario ${String(id || '').slice(0, 8)}`)
  const hoy = hoyEnChile()

  return (
    <div role="note" aria-label="Trabajadores con el turno sin terminar"
      className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
      {aviso && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {sinTerminar.length > 0 && (
        <>
          <p className="font-semibold">Estos trabajadores siguen con su turno sin terminar en esta caja:</p>
          <ul className="flex flex-col gap-2">
            {sinTerminar.map((t) => {
              const esEste = String(t.id) === String(turnoId)
              const desde = horaDe(t.opened_at)
              return (
                <li key={t.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <span className="font-semibold">{nombre(t.cashier_user_id)}</span>
                      {esEste && <span className="text-xs"> · este turno</span>}
                      {(desde || t.business_date !== hoy) && (
                        <span className="block text-xs">
                          Abierto{desde ? ` desde las ${desde}` : ''}{t.business_date && t.business_date !== hoy ? ` · turno del ${t.business_date.split('-').reverse().join('/')}` : ''}
                        </span>
                      )}
                    </span>
                    {forzando !== t.id && (
                      <Button type="button" size="sm" variant="outline" aria-label={`Forzar término del turno de ${nombre(t.cashier_user_id)}`}
                        onClick={() => { setForzando(t.id); setAviso('') }}>
                        Forzar término
                      </Button>
                    )}
                  </div>
                  {forzando === t.id && (
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-[hsl(var(--foreground))]">
                      <ForzarTerminoForm
                        turnoId={t.id}
                        titulo={`Forzar término de ${nombre(t.cashier_user_id)}`}
                        textoBoton="Forzar término"
                        destinos={empleadosConTurnoHoy(usuarios, abiertas, { localId, hoy, excepto: t.cashier_user_id })}
                        onCancelar={() => setForzando(null)}
                        onHecho={(texto) => { setForzando(null); setAviso(`${nombre(t.cashier_user_id)}: ${texto}`); onTerminado?.() }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs">Si ya terminaron de trabajar, fuerza el término de su turno antes de cerrar.</p>
        </>
      )}
    </div>
  )
}
