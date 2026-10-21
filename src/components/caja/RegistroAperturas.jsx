import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { textoDiferencia } from '../../lib/arqueo'
import { aperturasDelLocal, mensajeCajaFisica, resumenDeApertura } from '../../lib/cajaFisica'
import TurnosDeLaApertura from './TurnosDeLaApertura'

const VISIBLES = 10
const dinero = (v) => (v === null || v === undefined || v === '' ? '—' : formatMoney(Number(v)))
const claseDif = (v) => (Number(v) < 0 ? 'text-red-600' : Number(v) > 0 ? 'text-amber-700' : 'text-emerald-700')

function Fila({ apertura: a, nombreDe }) {
  const [verTurnos, setVerTurnos] = useState(false)
  const [turnos, setTurnos] = useState(null)
  const [error, setError] = useState('')
  const abierta = String(a.status) === 'open'
  // Nombre de la persona (por su id o su correo); sin la lista de usuarios, el correo.
  const persona = (id, email) => (nombreDe ? nombreDe(id, email) : email) || '—'

  useEffect(() => {
    if (!verTurnos || turnos !== null) return undefined
    let ignore = false
    resumenDeApertura(a.id)
      .then((r) => { if (!ignore) setTurnos(Array.isArray(r?.turnos) ? r.turnos : []) })
      .catch((err) => { if (!ignore) { setTurnos([]); setError(mensajeCajaFisica(err, 'No se pudieron cargar los turnos')) } })
    return () => { ignore = true }
  }, [verTurnos, turnos, a.id])

  return (
    <li className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]">
          {a.cajaNombre}
          <Badge variant={abierta ? 'success' : 'destructive'}>{abierta ? 'Abierta' : 'Cerrada'}</Badge>
        </span>
        <Button type="button" size="sm" variant="ghost" aria-expanded={verTurnos} onClick={() => setVerTurnos((v) => !v)}>
          {verTurnos ? 'Ocultar turnos' : 'Ver turnos'}
        </Button>
      </div>
      <p className="mt-0.5">
        Abrió {persona(a.abierta_por_user_id, a.abierta_por_email)} el {fechaHora(a.abierta_at)} con {dinero(a.monto_apertura)}
        {a.nota_apertura ? ` · Nota: ${a.nota_apertura}` : ''}
      </p>
      {!abierta && (
        <p className="mt-0.5">
          Cerró {persona(a.cerrada_por_user_id, a.cerrada_por_email)} el {fechaHora(a.cerrada_at)} · contado {dinero(a.monto_cierre_declarado)} · esperado {dinero(a.efectivo_esperado_cierre)}
          {a.diferencia_cierre !== null && a.diferencia_cierre !== undefined && (
            <span className={cn('font-semibold', claseDif(a.diferencia_cierre))}> · {textoDiferencia(Number(a.diferencia_cierre))}</span>
          )}
          {a.nota_cierre ? ` · Nota: ${a.nota_cierre}` : ''}
        </p>
      )}
      {verTurnos && (
        <div className="mt-1.5">
          {error ? <p role="alert" className="text-red-600">{error}</p>
            : turnos === null ? <p className="text-[hsl(var(--muted-foreground))]">Cargando los turnos…</p>
              : <TurnosDeLaApertura turnos={turnos} nombreDe={nombreDe} />}
        </div>
      )}
    </li>
  )
}

/**
 * Registro de aperturas y cierres de todas las cajas del local (#133). Abrir
 * una caja no crea un turno: es su propio registro, con el fondo, quién abrió y
 * quién cerró, lo contado y la diferencia; los turnos de los empleados cuelgan
 * de cada apertura («Ver turnos»). `version` cambia cuando se abre o se cierra
 * una caja, para volver a pedir la lista.
 */
export default function RegistroAperturas({ cajasFisicas = [], version = 0, nombreDe = null }) {
  const [estado, setEstado] = useState({ clave: '', aperturas: [], error: '' })
  const [todas, setTodas] = useState(false)
  const ids = (Array.isArray(cajasFisicas) ? cajasFisicas : []).map((c) => c.id).join(',')
  const clave = `${ids}|${version}`

  useEffect(() => {
    let ignore = false
    aperturasDelLocal(cajasFisicas)
      .then((aperturas) => { if (!ignore) setEstado({ clave, aperturas, error: '' }) })
      .catch((err) => { if (!ignore) setEstado({ clave, aperturas: [], error: mensajeCajaFisica(err, 'No se pudo cargar el registro') }) })
    return () => { ignore = true }
  // Se vuelve a pedir cuando cambian las cajas o se abre o cierra una (`clave`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  if (estado.clave !== clave) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el registro…</p>
  if (estado.error) return <p role="alert" className="text-sm text-red-600">{estado.error}</p>
  if (estado.aperturas.length === 0) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no se ha abierto ninguna caja en este local.</p>

  const visibles = todas ? estado.aperturas : estado.aperturas.slice(0, VISIBLES)
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Apertura de caja" className="flex flex-col gap-2">
        {visibles.map((a) => <Fila key={a.id} apertura={a} nombreDe={nombreDe} />)}
      </ol>
      {estado.aperturas.length > VISIBLES && (
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver menos' : `Ver todas (${estado.aperturas.length})`}
        </Button>
      )}
    </div>
  )
}
