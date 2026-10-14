import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../context/AuthContext'
import { TurnoVendedorContext } from '../../context/turnoVendedor'
import { createCajaV2, getMiTurnoDeHoy } from '../../lib/salesApi'
import { listarCajasFisicas } from '../../lib/administrativeApi'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { isAlPasoLocal } from '../../lib/salesModel'
import { elegirMaquinaDelTurno, errorAlTomarMaquina, turnoTieneMaquina } from '../../lib/maquinasCobro'
import ElegirMaquina from './ElegirMaquina'
import CambiarLocal from '../CambiarLocal'

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
 * No se le pide efectivo inicial: el dinero con que parte la caja lo registra
 * el encargado o el dueño al abrir su turno de caja (Caja y turnos), y el
 * arqueo del día lo suma por caja física. El turno del vendedor parte en 0.
 *
 * Máquina POS (bandera `eleccionMaquinaVendedor`, sección 5b del backend):
 * - Restaurante: antes de abrir el turno elige la máquina con que cobrará con
 *   tarjeta (o la comparte con una persona más) y viaja en `POST /cajas`. Si
 *   vuelve a entrar con el turno abierto y sin máquina (se la liberaron), elige
 *   otra con `PUT /cajas/{id}/maquina` o sigue cobrando sin tarjeta.
 * - Comida al paso: la máquina está anclada a la caja física; no elige nada.
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
  const [abriendo, setAbriendo] = useState(false)
  const [intento, setIntento] = useState(0)
  // Restaurante con la bandera encendida: el turno se abre eligiendo la máquina POS.
  const eligeMaquina = isV2FeatureEnabled('eleccionMaquinaVendedor') && !isAlPasoLocal(user?.local_sales_model)

  // ¿Ya tiene su turno de hoy? Se vuelve a preguntar al reintentar o al cerrarse el turno.
  useEffect(() => {
    let ignore = false
    getMiTurnoDeHoy(localId)
      .then((mio) => {
        if (ignore) return
        setTurno(mio)
        // Con el turno ya abierto (volvió a entrar), elige máquina solo si no tiene una.
        setFase(!mio ? 'pregunta' : eligeMaquina && !turnoTieneMaquina(mio) ? 'maquina-turno' : 'listo')
      })
      .catch((e) => {
        if (ignore) return
        setError(e?.message || 'No se pudo revisar tu turno')
        setFase('error')
      })
    return () => { ignore = true }
  }, [localId, intento, eligeMaquina])

  const reintentar = useCallback(() => { setError(''); setFase('cargando'); setIntento((n) => n + 1) }, [])

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
    setError('')
    // En restaurante primero elige la máquina: el turno se abre con ella.
    if (eligeMaquina) { setFase('maquina-apertura'); return }
    setAbriendo(true)
    try {
      // Sin cashier_user_id explícito, el turno queda a nombre de quien lo abre.
      // En 0: el efectivo inicial no es del vendedor (lo registra el encargado).
      const nuevo = await createCajaV2({ caja_fisica_id: cajaFisicaId, monto_apertura: 0 })
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
    setFase('pregunta')
  }, [])

  // Abre el turno con la máquina elegida (restaurante).
  const abrirConMaquina = useCallback(async (maquina, { compartir }) => {
    try {
      const nuevo = await createCajaV2({
        caja_fisica_id: cajaFisicaId, monto_apertura: 0, pos_machine_id: maquina.id, compartir,
      })
      setTurno(nuevo)
      setFase('listo')
    } catch (err) {
      // Ya tenía su turno de hoy en esa caja: se lo toma y entra.
      if (/ya existe una caja abierta/i.test(String(err?.detail || err?.message || ''))) { reintentar(); return }
      throw errorAlTomarMaquina(err)
    }
  }, [cajaFisicaId, reintentar])

  // Turno ya abierto sin máquina: elige otra.
  const tomarMaquinaDelTurno = useCallback(async (maquina, { compartir }) => {
    const actualizado = await elegirMaquinaDelTurno(turno.id, maquina.id, { compartir })
    setTurno((t) => ({ ...t, ...actualizado }))
    setFase('listo')
  }, [turno])

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

  if (fase === 'maquina-apertura') {
    return (
      <Tarjeta titulo="Elige tu máquina de cobro" subtitulo={subtitulo}>
        <ElegirMaquina
          localId={localId}
          onConfirmar={abrirConMaquina}
          textoConfirmar="Abrir turno con esta máquina"
          onSinMaquina={() => setFase('formulario')}
          textoSinMaquina="Volver"
        />
      </Tarjeta>
    )
  }

  if (fase === 'maquina-turno') {
    return (
      <Tarjeta titulo="Tu turno no tiene máquina de cobro" subtitulo={subtitulo}>
        <ElegirMaquina
          localId={localId}
          onConfirmar={tomarMaquinaDelTurno}
          onSinMaquina={() => setFase('listo')}
          textoSinMaquina="Seguir sin tarjeta"
        />
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
          <div className="flex items-center gap-2">
            {/* Con más de un local asignado puede cambiarse antes de abrir el turno (T-73). */}
            <CambiarLocal />
            <Button onClick={irAlFormulario}>Iniciar turno</Button>
          </div>
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
