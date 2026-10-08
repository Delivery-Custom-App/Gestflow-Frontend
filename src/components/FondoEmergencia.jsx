import { useCallback, useEffect, useMemo, useState } from 'react'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { listUsers } from '../lib/apiClient'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { nombreDeVendedor } from '../lib/registroTurnos'
import {
  MOTIVO_MAXIMO, crearFondo, getFondoDelLocal, listarMovimientos, mensajeDeErrorDelFondo, montoDesdeTexto,
  puedeManejarFondo, registrarMovimiento, validarCreacion, validarMovimiento,
} from '../lib/fondoEmergencia'

const soloMonto = (v) => v.replace(/[^\d.]/g, '')

function fechaHora(valor) {
  const d = valor ? new Date(valor) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
}

function Aviso({ tipo = 'error', children }) {
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-3 py-2 text-sm',
      tipo === 'error'
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300')}>
      {children}
    </p>
  )
}

/** Crear el fondo del local, con un monto inicial (puede ser 0). */
function CrearFondo({ localId, onCreado }) {
  const [monto, setMonto] = useState('0')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const crear = async (e) => {
    e.preventDefault()
    const montoInicial = montoDesdeTexto(monto)
    const problema = validarCreacion({ montoInicial })
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await crearFondo(localId, montoInicial)
      await onCreado()
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={crear} className="flex flex-col gap-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Este local todavía no tiene fondo de emergencia: plata apartada para imprevistos, con su saldo y el registro
        de cada aporte y cada uso.
      </p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="fondo-monto-inicial">Monto inicial (CLP)</Label>
        <Input id="fondo-monto-inicial" inputMode="numeric" value={monto} disabled={guardando}
          onChange={(e) => { setMonto(soloMonto(e.target.value)); setError('') }} />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Puede ser 0 y aportar después.</p>
      </div>
      <Button type="submit" disabled={guardando} className="self-start gap-2">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear fondo de emergencia
      </Button>
    </form>
  )
}

/** Aportar o registrar un uso. */
function Movimiento({ fondo, onHecho }) {
  const [tipo, setTipo] = useState('aporte')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')
  const [guardando, setGuardando] = useState(false)
  const saldo = Number(fondo.saldo) || 0

  const cambiarTipo = (nuevo) => { setTipo(nuevo); setError(''); setHecho('') }

  const guardar = async (e) => {
    e.preventDefault()
    setHecho('')
    const valor = montoDesdeTexto(monto)
    const problema = validarMovimiento({ tipo, monto: valor, motivo, saldo })
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await registrarMovimiento(fondo.id, { tipo, monto: valor, motivo })
      setMonto('')
      setMotivo('')
      setHecho(tipo === 'aporte' ? `Aporte de ${formatMoney(valor)} registrado.` : `Uso de ${formatMoney(valor)} registrado.`)
      await onHecho()
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
    } finally {
      setGuardando(false)
    }
  }

  const esUso = tipo === 'uso'
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div role="radiogroup" aria-label="Tipo de movimiento" className="inline-flex self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
        {[['aporte', 'Aportar'], ['uso', 'Registrar uso']].map(([valor, etiqueta]) => (
          <button key={valor} type="button" role="radio" aria-checked={tipo === valor} onClick={() => cambiarTipo(valor)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              tipo === valor ? 'bg-[hsl(var(--primary))] text-white shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
            {etiqueta}
          </button>
        ))}
      </div>
      {error && <Aviso>{error}</Aviso>}
      {hecho && <Aviso tipo="ok">{hecho}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fondo-monto">Monto (CLP)</Label>
          <Input id="fondo-monto" inputMode="numeric" value={monto} disabled={guardando}
            onChange={(e) => { setMonto(soloMonto(e.target.value)); setError(''); setHecho('') }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fondo-motivo">{esUso ? 'Motivo' : 'Nota (opcional)'}</Label>
          <Input id="fondo-motivo" value={motivo} maxLength={MOTIVO_MAXIMO} disabled={guardando}
            placeholder={esUso ? 'Ej.: reparación de la cámara de frío' : ''}
            onChange={(e) => { setMotivo(e.target.value); setError(''); setHecho('') }} />
        </div>
      </div>
      {esUso && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Se puede usar hasta {formatMoney(saldo)}: el fondo no puede quedar en negativo.
        </p>
      )}
      <Button type="submit" disabled={guardando} className="self-start gap-2">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        {esUso ? 'Registrar uso' : 'Aportar'}
      </Button>
    </form>
  )
}

/**
 * Fondo de emergencia del local (Administración). Solo el dueño y el
 * encargado; el vendedor ni siquiera tiene la ruta. Detrás de la bandera
 * `fondoEmergencia` hasta que exista el backend (B-09).
 */
export default function FondoEmergencia({ localId }) {
  const { userRole } = useAuth()
  const permitido = puedeManejarFondo(userRole)
  const [estado, setEstado] = useState({ cargando: true, error: '', fondo: null, movimientos: [] })
  const [usuarios, setUsuarios] = useState([])
  const [intento, setIntento] = useState(0)

  const cargar = useCallback(async () => {
    const fondo = await getFondoDelLocal(localId)
    const movimientos = fondo ? await listarMovimientos(fondo.id) : []
    setEstado({ cargando: false, error: '', fondo, movimientos })
  }, [localId])

  useEffect(() => {
    if (!permitido) return undefined
    let ignore = false
    getFondoDelLocal(localId)
      .then(async (fondo) => {
        const movimientos = fondo ? await listarMovimientos(fondo.id) : []
        if (!ignore) setEstado({ cargando: false, error: '', fondo, movimientos })
      })
      .catch((e) => { if (!ignore) setEstado({ cargando: false, error: mensajeDeErrorDelFondo(e), fondo: null, movimientos: [] }) })
    // Para decir quién hizo cada movimiento (el encargado no puede leer al dueño: queda un id corto).
    listUsers().then((u) => { if (!ignore) setUsuarios(u) }).catch(() => {})
    return () => { ignore = true }
  }, [localId, permitido, intento])

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [String(u.id), u])), [usuarios])

  if (!permitido) {
    return <Aviso>El fondo de emergencia solo lo manejan el dueño y el encargado del local.</Aviso>
  }
  if (estado.cargando) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el fondo de emergencia…</p>
  }
  if (estado.error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Aviso>{estado.error}</Aviso>
        <Button variant="outline" size="sm" onClick={() => { setEstado((s) => ({ ...s, cargando: true })); setIntento((n) => n + 1) }}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!estado.fondo) {
    return <CrearFondo localId={localId} onCreado={cargar} />
  }

  const { fondo, movimientos } = estado
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.06)] p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
          <LifeBuoy size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Saldo del fondo</p>
          <p data-testid="saldo-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(fondo.saldo) || 0)}</p>
        </div>
      </div>

      <Movimiento fondo={fondo} onHecho={cargar} />

      <section aria-labelledby="fondo-historial" className="flex flex-col gap-2">
        <h3 id="fondo-historial" className="text-sm font-bold text-[hsl(var(--foreground))]">Historial</h3>
        {movimientos.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay aportes ni usos registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  {['Fecha', 'Movimiento', 'Monto', 'Motivo', 'Quién'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const esUso = m.tipo === 'uso'
                  return (
                    <tr key={m.id} className="border-t border-[hsl(var(--border))]">
                      <td className="px-4 py-3 whitespace-nowrap">{fechaHora(m.created_at)}</td>
                      <td className="px-4 py-3">{esUso ? 'Uso' : 'Aporte'}</td>
                      <td className={cn('px-4 py-3 whitespace-nowrap font-semibold', esUso ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
                        {esUso ? '− ' : '+ '}{formatMoney(Number(m.monto) || 0)}
                      </td>
                      <td className="px-4 py-3">{m.motivo || '—'}</td>
                      <td className="px-4 py-3">{m.actor_user_id ? nombreDeVendedor(usuariosPorId, m.actor_user_id) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
