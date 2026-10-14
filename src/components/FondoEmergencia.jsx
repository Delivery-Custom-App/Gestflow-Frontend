import { useCallback, useEffect, useState } from 'react'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { normalizeRoleKey } from '../auth/roleLabel'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import {
  MOTIVO_MAXIMO, MOVIMIENTOS_POR_PAGINA, TIPO_LABEL, corregirGasto, crearFondo, definirMontoFijo, faltaReponer,
  fechaCorta, getFondo, hoyEnChile, listarHistorial, mensajeDeErrorDelFondo, montoDesdeTexto, porCorregir,
  puedeManejarFondo, registrarMovimiento, restaSaldo, sePuedeCorregir, tieneFondo, validarAjuste,
  validarMontoFijo, validarMovimiento,
} from '../lib/fondoEmergencia'

const soloMonto = (v) => v.replace(/[^\d.]/g, '')

function fechaHora(valor) {
  const d = valor ? new Date(valor) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' })
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

function Monto({ tipo, monto }) {
  const resta = restaSaldo(tipo)
  return (
    <span className={cn('whitespace-nowrap font-semibold', resta ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
      {resta ? '− ' : '+ '}{formatMoney(monto)}
    </span>
  )
}

/** Primer paso: definir el monto fijo. Se registra una reposición por ese monto. */
function DefinirFondo({ localId, onListo }) {
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const crear = async (e) => {
    e.preventDefault()
    const montoFijo = montoDesdeTexto(monto)
    const problema = validarMontoFijo(montoFijo)
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await crearFondo(localId, montoFijo)
      await onListo()
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={crear} className="flex flex-col gap-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Este local todavía no tiene fondo de emergencia: plata apartada para imprevistos. Define cuánto debe tener
        (el monto fijo); se registra una reposición por ese monto y desde ahí se anotan los gastos y las reposiciones.
      </p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="fondo-monto-fijo">Monto fijo (CLP)</Label>
        <Input id="fondo-monto-fijo" inputMode="numeric" value={monto} disabled={guardando} placeholder="Ej.: 50000"
          onChange={(e) => { setMonto(soloMonto(e.target.value)); setError('') }} />
      </div>
      <Button type="submit" disabled={guardando} className="self-start gap-2">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear fondo de emergencia
      </Button>
    </form>
  )
}

/** Cambiar el monto fijo (no mueve el saldo: para completarlo se registra una reposición). */
function CambiarMontoFijo({ localId, actual, onListo, onCancelar }) {
  const [monto, setMonto] = useState(String(actual))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const guardar = async (e) => {
    e.preventDefault()
    const valor = montoDesdeTexto(monto)
    const problema = validarMontoFijo(valor)
    if (problema) { setError(problema); return }
    setGuardando(true)
    try {
      await definirMontoFijo(localId, valor)
      await onListo()
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
      setGuardando(false)
    }
  }
  return (
    <form onSubmit={guardar} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fondo-nuevo-monto-fijo">Nuevo monto fijo (CLP)</Label>
        <Input id="fondo-nuevo-monto-fijo" inputMode="numeric" value={monto} disabled={guardando} className="w-40"
          onChange={(e) => { setMonto(soloMonto(e.target.value)); setError('') }} />
      </div>
      <Button type="submit" size="sm" disabled={guardando}>Guardar</Button>
      <Button type="button" size="sm" variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
      {error && <div className="w-full"><Aviso>{error}</Aviso></div>}
    </form>
  )
}

/** Registrar un gasto o una reposición, con su fecha (entre fecha_minima y hoy). */
function NuevoMovimiento({ localId, fondo, onHecho }) {
  const hoy = hoyEnChile()
  const [tipo, setTipo] = useState('gasto')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')
  const [guardando, setGuardando] = useState(false)
  const falta = faltaReponer(fondo)

  const limpiarAvisos = () => { setError(''); setHecho('') }
  const cambiarTipo = (nuevo) => {
    if (nuevo === tipo) return
    setTipo(nuevo)
    limpiarAvisos()
    // Al cambiar de tipo el monto se reinicia (no se arrastra el del gasto); al reponer se sugiere
    // lo que falta para volver al monto fijo.
    setMonto(nuevo === 'reposicion' && falta > 0 ? String(falta) : '')
    setMotivo('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    setHecho('')
    const valor = montoDesdeTexto(monto)
    const problema = validarMovimiento({ tipo, monto: valor, motivo, fecha, fechaMinima: fondo.fechaMinima, hoy, saldo: fondo.saldo })
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await registrarMovimiento(localId, { tipo, monto: valor, motivo, fecha })
      setMonto('')
      setMotivo('')
      setFecha(hoy)
      setHecho(`${TIPO_LABEL[tipo]} de ${formatMoney(valor)} ${tipo === 'gasto' ? 'registrado' : 'registrada'}.`)
      await onHecho()
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
    } finally {
      setGuardando(false)
    }
  }

  const esGasto = tipo === 'gasto'
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div role="radiogroup" aria-label="Tipo de movimiento" className="inline-flex self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
        {[['gasto', 'Registrar gasto'], ['reposicion', 'Reponer']].map(([valor, etiqueta]) => (
          <button key={valor} type="button" role="radio" aria-checked={tipo === valor} onClick={() => cambiarTipo(valor)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              tipo === valor ? 'bg-[hsl(var(--primary))] text-white shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
            {etiqueta}
          </button>
        ))}
      </div>
      {error && <Aviso>{error}</Aviso>}
      {hecho && <Aviso tipo="ok">{hecho}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-[160px_160px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fondo-monto">Monto (CLP)</Label>
          <Input id="fondo-monto" inputMode="numeric" value={monto} disabled={guardando}
            onChange={(e) => { setMonto(soloMonto(e.target.value)); limpiarAvisos() }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fondo-fecha">Fecha</Label>
          <Input id="fondo-fecha" type="date" value={fecha} min={fondo.fechaMinima} max={hoy} disabled={guardando}
            onChange={(e) => { setFecha(e.target.value); limpiarAvisos() }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fondo-motivo">{esGasto ? 'Motivo' : 'Nota (opcional)'}</Label>
          <Input id="fondo-motivo" value={motivo} maxLength={MOTIVO_MAXIMO} disabled={guardando}
            placeholder={esGasto ? 'Ej.: reparación de la cámara de frío' : ''}
            onChange={(e) => { setMotivo(e.target.value); limpiarAvisos() }} />
        </div>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {esGasto
          ? `Disponible: ${formatMoney(fondo.saldo)}. El fondo no puede quedar en negativo.`
          : falta > 0 ? `Para volver al monto fijo faltan ${formatMoney(falta)}.` : 'El fondo está completo.'}
        {' '}La fecha puede ser desde el {fechaCorta(fondo.fechaMinima)} hasta hoy.
      </p>
      <Button type="submit" disabled={guardando} className="self-start gap-2">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        {esGasto ? 'Registrar gasto' : 'Reponer'}
      </Button>
    </form>
  )
}

/** Corregir (todo o parte de) un gasto mal anotado. */
function CorregirGasto({ localId, gasto, onListo, onCancelar }) {
  const maximo = porCorregir(gasto)
  const [monto, setMonto] = useState(String(maximo))
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const guardar = async (e) => {
    e.preventDefault()
    const valor = montoDesdeTexto(monto)
    const problema = validarAjuste({ monto: valor, motivo, maximo })
    if (problema) { setError(problema); return }
    setGuardando(true)
    try {
      await corregirGasto(localId, gasto.id, { monto: valor, motivo })
      await onListo(valor)
    } catch (err) {
      setError(mensajeDeErrorDelFondo(err))
      setGuardando(false)
    }
  }
  return (
    <form onSubmit={guardar} aria-label="Corregir gasto" className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Se puede corregir hasta {formatMoney(maximo)}. La corrección devuelve ese monto al saldo; el gasto original no se borra.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ajuste-monto-${gasto.id}`}>Monto a corregir</Label>
          <Input id={`ajuste-monto-${gasto.id}`} inputMode="numeric" value={monto} disabled={guardando} className="w-36"
            onChange={(e) => { setMonto(soloMonto(e.target.value)); setError('') }} />
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor={`ajuste-motivo-${gasto.id}`}>Motivo</Label>
          <Input id={`ajuste-motivo-${gasto.id}`} value={motivo} maxLength={MOTIVO_MAXIMO} disabled={guardando}
            placeholder="Ej.: se anotó el doble" onChange={(e) => { setMotivo(e.target.value); setError('') }} />
        </div>
        <Button type="submit" size="sm" disabled={guardando}>Guardar corrección</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
      </div>
      {error && <Aviso>{error}</Aviso>}
    </form>
  )
}

/** Movimientos de la semana vigente (desde fecha_minima), con "Corregir" en los gastos. */
function MovimientosDeLaSemana({ localId, fondo, onCambio, soloLectura = false }) {
  const [corrigiendo, setCorrigiendo] = useState(null)
  const [hecho, setHecho] = useState('')
  const filas = fondo.movimientos
  return (
    <section aria-labelledby="fondo-semana" className="flex flex-col gap-2">
      <h3 id="fondo-semana" className="text-sm font-bold text-[hsl(var(--foreground))]">
        Movimientos recientes <span className="font-normal text-[hsl(var(--muted-foreground))]">(desde el {fechaCorta(fondo.fechaMinima)})</span>
      </h3>
      {hecho && <Aviso tipo="ok">{hecho}</Aviso>}
      {filas.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay movimientos en la semana.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]" aria-label="Movimientos recientes">
          {filas.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="w-24 text-xs text-[hsl(var(--muted-foreground))]">{fechaCorta(m.fecha)}</span>
                <span className="w-24">{TIPO_LABEL[m.tipo] || m.tipo}</span>
                <Monto tipo={m.tipo} monto={m.monto} />
                <span className="min-w-0 flex-1 text-[hsl(var(--muted-foreground))]">
                  {m.motivo || '—'}
                  {m.tipo === 'gasto' && m.ajustado > 0 && <span className="ml-2 text-xs">(corregido {formatMoney(m.ajustado)})</span>}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{m.registradoPor || '—'}</span>
                {!soloLectura && sePuedeCorregir(m, fondo.fechaMinima) && corrigiendo !== m.id && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setCorrigiendo(m.id); setHecho('') }}
                    aria-label={`Corregir gasto de ${formatMoney(m.monto)}`}>
                    Corregir
                  </Button>
                )}
              </div>
              {corrigiendo === m.id && (
                <CorregirGasto localId={localId} gasto={m} onCancelar={() => setCorrigiendo(null)}
                  onListo={async (valor) => { setCorrigiendo(null); setHecho(`Corrección de ${formatMoney(valor)} registrada.`); await onCambio() }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Todo el libro del fondo, por páginas (GET …/movimientos con X-Total-Count). */
function Historial({ localId, version }) {
  const [pagina, setPagina] = useState(0)
  const [estado, setEstado] = useState({ cargando: true, error: '', movimientos: [], total: 0 })

  useEffect(() => {
    let ignore = false
    listarHistorial(localId, { limit: MOVIMIENTOS_POR_PAGINA, offset: pagina * MOVIMIENTOS_POR_PAGINA })
      .then(({ movimientos, total }) => { if (!ignore) setEstado({ cargando: false, error: '', movimientos, total }) })
      .catch((e) => { if (!ignore) setEstado({ cargando: false, error: mensajeDeErrorDelFondo(e), movimientos: [], total: 0 }) })
    return () => { ignore = true }
  }, [localId, pagina, version])

  const paginas = Math.max(1, Math.ceil(estado.total / MOVIMIENTOS_POR_PAGINA))
  return (
    <section aria-labelledby="fondo-historial" className="flex flex-col gap-2">
      <h3 id="fondo-historial" className="text-sm font-bold text-[hsl(var(--foreground))]">Historial</h3>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.cargando ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el historial…</p>
      ) : estado.movimientos.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay movimientos.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  {['Fecha', 'Movimiento', 'Monto', 'Motivo', 'Registrado por', 'Registrado el'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estado.movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-[hsl(var(--border))]">
                    <td className="px-4 py-3 whitespace-nowrap">{fechaCorta(m.fecha)}</td>
                    <td className="px-4 py-3">{TIPO_LABEL[m.tipo] || m.tipo}</td>
                    <td className="px-4 py-3"><Monto tipo={m.tipo} monto={m.monto} /></td>
                    <td className="px-4 py-3">{m.motivo || '—'}</td>
                    <td className="px-4 py-3">{m.registradoPor || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[hsl(var(--muted-foreground))]">{fechaHora(m.registradoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{estado.total} movimiento{estado.total === 1 ? '' : 's'} · página {pagina + 1} de {paginas}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pagina === 0} onClick={() => { setEstado((s) => ({ ...s, cargando: true })); setPagina((p) => p - 1) }}>Anterior</Button>
              <Button type="button" size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => { setEstado((s) => ({ ...s, cargando: true })); setPagina((p) => p + 1) }}>Siguiente</Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Fondo de emergencia del local (Administración, T-26). Solo el dueño y el
 * encargado lo manejan; el superadmin lo ve sin poder escribir; el vendedor no
 * tiene la ruta.
 */
export default function FondoEmergencia({ localId }) {
  const { userRole } = useAuth()
  const permitido = puedeManejarFondo(userRole)
  const soloLectura = normalizeRoleKey(userRole) === 'SUPERADMIN'
  const [estado, setEstado] = useState({ cargando: true, error: '', fondo: null })
  const [intento, setIntento] = useState(0)
  const [version, setVersion] = useState(0)
  const [cambiandoMonto, setCambiandoMonto] = useState(false)

  const cargar = useCallback(async () => {
    const fondo = await getFondo(localId)
    setEstado({ cargando: false, error: '', fondo })
    setVersion((v) => v + 1)
  }, [localId])

  useEffect(() => {
    if (!permitido) return undefined
    let ignore = false
    getFondo(localId)
      .then((fondo) => { if (!ignore) setEstado({ cargando: false, error: '', fondo }) })
      .catch((e) => { if (!ignore) setEstado({ cargando: false, error: mensajeDeErrorDelFondo(e), fondo: null }) })
    return () => { ignore = true }
  }, [localId, permitido, intento])

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
  const { fondo } = estado
  if (!tieneFondo(fondo)) {
    return soloLectura
      ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local todavía no tiene fondo de emergencia.</p>
      : <DefinirFondo localId={localId} onListo={cargar} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.06)] p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
            <LifeBuoy size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Saldo del fondo</p>
            <p data-testid="saldo-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(fondo.saldo)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Monto fijo</p>
          {cambiandoMonto ? (
            <CambiarMontoFijo localId={localId} actual={fondo.montoFijo} onCancelar={() => setCambiandoMonto(false)}
              onListo={async () => { setCambiandoMonto(false); await cargar() }} />
          ) : (
            <div className="flex items-center gap-3">
              <p data-testid="monto-fijo-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(fondo.montoFijo)}</p>
              {!soloLectura && <Button type="button" size="sm" variant="outline" onClick={() => setCambiandoMonto(true)}>Cambiar</Button>}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Gastado esta semana</p>
          <p data-testid="gastado-semana-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(fondo.gastadoSemana)}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{fechaCorta(fondo.semanaInicio)} al {fechaCorta(fondo.semanaFin)}</p>
        </div>
      </div>

      {!soloLectura && <NuevoMovimiento localId={localId} fondo={fondo} onHecho={cargar} />}
      <MovimientosDeLaSemana localId={localId} fondo={fondo} onCambio={cargar} soloLectura={soloLectura} />
      <Historial localId={localId} version={version} />
    </div>
  )
}
