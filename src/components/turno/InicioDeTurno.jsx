import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../context/AuthContext'
import { TurnoVendedorContext } from '../../context/turnoVendedor'
import { createCajaV2, getMiTurnoDeHoy } from '../../lib/salesApi'
import { listarCajasFisicas } from '../../lib/administrativeApi'

/** Acepta "50.000" o "50000"; lo que no sea dígito se descarta. */
function montoDesdeTexto(texto) {
  return Number(String(texto ?? '').replace(/[^\d]/g, '')) || 0
}

function Tarjeta({ titulo, subtitulo, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
            <Clock3 className="h-5 w-5 text-[hsl(var(--primary))]" />
          </span>
          <div>
            <h1 className="text-base font-bold text-[hsl(var(--foreground))]">{titulo}</h1>
            {subtitulo && <p className="text-xs text-[hsl(var(--muted-foreground))]">{subtitulo}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Aviso({ children }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
      <p className="text-xs text-red-600 dark:text-red-400">{children}</p>
    </div>
  )
}

/**
 * El vendedor inicia su turno al entrar.
 *
 * Sin turno abierto hoy no puede vender (el backend exige un turno propio para
 * cada orden), así que antes de mostrarle el punto de venta se le pregunta
 * "¿Iniciar turno?". El turno queda a su nombre, sobre la caja física de su
 * local; si el local tiene una sola, se elige sola. Si ya tiene uno abierto
 * hoy, entra directo. Cerrarlo es del encargado o del dueño (Caja y turnos).
 *
 * Igual que el cambio de contraseña obligatorio, se muestra en lugar de la
 * aplicación sin tocar la URL: al abrir el turno, sigue donde iba.
 */
export default function InicioDeTurno({ localId, children }) {
  const { user, logout } = useAuth()
  const [fase, setFase] = useState('cargando') // cargando | pregunta | formulario | listo | error
  const [turno, setTurno] = useState(null)
  const [error, setError] = useState('')
  const [cajasFisicas, setCajasFisicas] = useState(null) // null = cargando
  const [cajaFisicaId, setCajaFisicaId] = useState('')
  const [monto, setMonto] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [intento, setIntento] = useState(0)

  // ¿Ya tiene su turno de hoy? Se vuelve a preguntar al reintentar o al cerrarse el turno.
  useEffect(() => {
    let ignore = false
    getMiTurnoDeHoy(localId)
      .then((mio) => {
        if (ignore) return
        setTurno(mio)
        setFase(mio ? 'listo' : 'pregunta')
      })
      .catch((e) => {
        if (ignore) return
        setError(e?.message || 'No se pudo revisar tu turno')
        setFase('error')
      })
    return () => { ignore = true }
  }, [localId, intento])

  const reintentar = () => { setError(''); setFase('cargando'); setIntento((n) => n + 1) }

  const irAlFormulario = () => {
    setError('')
    setFase('formulario')
    setCajasFisicas(null)
    listarCajasFisicas(localId)
      .then((filas) => {
        setCajasFisicas(filas)
        // Con una sola caja física no tiene sentido hacer elegir.
        setCajaFisicaId(filas.length === 1 ? String(filas[0].id) : '')
      })
      .catch(() => {
        setCajasFisicas([])
        setError('No se pudieron cargar las cajas físicas de tu local')
      })
  }

  const abrirTurno = async (e) => {
    e.preventDefault()
    if (!cajaFisicaId) { setError('Elige la caja física donde trabajarás'); return }
    setAbriendo(true)
    setError('')
    try {
      // Sin cashier_user_id explícito, el turno queda a nombre de quien lo abre.
      const nuevo = await createCajaV2({ caja_fisica_id: cajaFisicaId, monto_apertura: montoDesdeTexto(monto) })
      setTurno(nuevo)
      setFase('listo')
    } catch (err) {
      const mensaje = String(err?.message || '')
      if (/409|ya existe una caja abierta/i.test(mensaje)) {
        // Ya tenía un turno abierto hoy en esa caja: se lo toma y entra.
        reintentar()
        return
      }
      setError(mensaje || 'No se pudo abrir el turno')
    } finally {
      setAbriendo(false)
    }
  }

  const alCerrar = useCallback(() => {
    setTurno(null)
    setMonto('')
    setFase('pregunta')
  }, [])

  const valor = useMemo(() => ({ turno, alCerrar }), [turno, alCerrar])

  if (fase === 'listo') {
    return <TurnoVendedorContext.Provider value={valor}>{children}</TurnoVendedorContext.Provider>
  }

  if (fase === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Revisando tu turno…</p>
      </div>
    )
  }

  const subtitulo = user?.email || ''
  const salir = (
    <button type="button" onClick={logout} disabled={abriendo}
      className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40">
      Cerrar sesión
    </button>
  )

  if (fase === 'error') {
    return (
      <Tarjeta titulo="No se pudo revisar tu turno" subtitulo={subtitulo}>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex items-center justify-between gap-2">
          {salir}
          <Button onClick={reintentar}>Reintentar</Button>
        </div>
      </Tarjeta>
    )
  }

  if (fase === 'pregunta') {
    return (
      <Tarjeta titulo="¿Iniciar turno?" subtitulo={subtitulo}>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">
          Para vender necesitas tu turno abierto. Queda a tu nombre durante el día; lo cierra el
          encargado del local con el arqueo.
        </p>
        <div className="flex items-center justify-between gap-2">
          {salir}
          <Button onClick={irAlFormulario}>Iniciar turno</Button>
        </div>
      </Tarjeta>
    )
  }

  // fase === 'formulario'
  const sinCajas = Array.isArray(cajasFisicas) && cajasFisicas.length === 0
  return (
    <Tarjeta titulo="Iniciar turno" subtitulo={subtitulo}>
      {error && <Aviso>{error}</Aviso>}

      {cajasFisicas === null && (
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">Cargando las cajas de tu local…</p>
      )}

      {sinCajas && !error && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          Tu local todavía no tiene una caja física donde abrir el turno. Pídele al encargado que la cree.
        </div>
      )}

      {Array.isArray(cajasFisicas) && cajasFisicas.length > 0 && (
        <form onSubmit={abrirTurno} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turno-vendedor-caja">Caja física</Label>
            {cajasFisicas.length === 1 ? (
              <p id="turno-vendedor-caja" className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                <Store className="h-4 w-4 text-[hsl(var(--primary))]" /> {cajasFisicas[0].name || 'Caja del local'}
              </p>
            ) : (
              <select
                id="turno-vendedor-caja"
                value={cajaFisicaId}
                onChange={(e) => setCajaFisicaId(e.target.value)}
                disabled={abriendo}
                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
              >
                <option value="">Elige dónde trabajarás</option>
                {cajasFisicas.map((c) => <option key={c.id} value={c.id}>{c.name || 'Caja sin nombre'}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turno-vendedor-monto">Efectivo inicial</Label>
            <Input id="turno-vendedor-monto" inputMode="numeric" placeholder="0" value={monto}
              onChange={(e) => setMonto(e.target.value)} disabled={abriendo} />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Lo que hay en la caja al empezar. Puede ser 0.</p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" onClick={() => { setError(''); setFase('pregunta') }} disabled={abriendo}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40">
              Volver
            </button>
            <Button type="submit" disabled={abriendo}>{abriendo ? 'Abriendo…' : 'Abrir turno'}</Button>
          </div>
        </form>
      )}

      {(sinCajas || cajasFisicas === null) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {salir}
          {sinCajas && <Button variant="outline" onClick={irAlFormulario}>Reintentar</Button>}
        </div>
      )}
    </Tarjeta>
  )
}
