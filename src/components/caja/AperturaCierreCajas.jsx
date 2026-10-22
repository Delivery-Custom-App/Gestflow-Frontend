import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { ultimoCierreDe } from '../../lib/cajaFisica'
import AbrirCajaFisica from './AbrirCajaFisica'
import CerrarCajaFisica from './CerrarCajaFisica'
import MovimientoCajaFisica from './MovimientoCajaFisica'
import HistorialAperturas from './HistorialAperturas'

// Con pocas cajas se ven todas; desde aquí aparecen los filtros.
const CAJAS_SIN_FILTRO = 3
const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'abiertas', label: 'Abiertas' },
  { id: 'cerradas', label: 'Cerradas' },
]

/** «⋯» de una caja abierta: retiro o ingreso, e historial. Se cierra al elegir, con Escape o al hacer clic afuera. */
function MasAcciones({ nombre, onMovimiento, onHistorial }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const afuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [abierto])
  const elegir = (accion) => () => { setAbierto(false); accion() }
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setAbierto(false) }}>
      <Button type="button" variant="outline" size="icon" className="rounded-lg" aria-label={`Más acciones de ${nombre}`} aria-haspopup="menu" aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}>
        <MoreHorizontal size={18} />
      </Button>
      {abierto && (
        <div role="menu" aria-label={`Acciones de ${nombre}`}
          className="absolute bottom-full right-0 z-20 mb-2 flex min-w-56 flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1.5 shadow-xl">
          <button type="button" role="menuitem" aria-label={`Retiro o ingreso en ${nombre}`} onClick={elegir(onMovimiento)}
            className="rounded-lg px-3 py-2.5 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
            Retiro o ingreso
          </button>
          <button type="button" role="menuitem" aria-label={`Historial de ${nombre}`} onClick={elegir(onHistorial)}
            className="rounded-lg px-3 py-2.5 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
            Historial de la caja
          </button>
        </div>
      )}
    </div>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[hsl(var(--muted-foreground))]">{etiqueta}</dt>
      <dd className="truncate font-semibold text-[hsl(var(--foreground))]">{children}</dd>
    </div>
  )
}

/**
 * La caja del día (#133): cada caja física activa del local con su estado
 * (abierta desde cuándo y por quién, o cerrada con lo que dejó el último
 * cierre) y, para el encargado y el dueño, abrir, registrar un retiro o
 * ingreso, cerrar y ver el historial. Las abiertas van primero, como
 * tarjetas; las cerradas, más chicas, con «Abrir caja» a mano.
 * `turnosPorCaja` (id de la caja → turnos abiertos) es opcional.
 */
export default function AperturaCierreCajas({ cajasFisicas = [], localNombre = '', cierra = '', puedeGestionar = false, nombreDe = null, turnosPorCaja = null, onCambio }) {
  const [accion, setAccion] = useState(null) // { tipo: 'abrir' | 'cerrar' | 'movimiento' | 'historial', caja }
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const activas = (Array.isArray(cajasFisicas) ? cajasFisicas : []).filter((c) => c.is_active !== false)
  // Las abiertas primero; dentro de cada grupo, el orden del backend.
  const ordenadas = [...activas.filter((c) => c.abierta), ...activas.filter((c) => !c.abierta)]
  const conFiltros = activas.length > CAJAS_SIN_FILTRO
  const visibles = !conFiltros || filtro === 'todas' ? ordenadas
    : ordenadas.filter((c) => (filtro === 'abiertas' ? c.abierta : !c.abierta))
  const cuenta = { todas: activas.length, abiertas: activas.filter((c) => c.abierta).length, cerradas: activas.filter((c) => !c.abierta).length }
  // Nombre de la persona (por su id o su correo); sin la lista de usuarios, el correo.
  const persona = (id, email) => (nombreDe ? nombreDe(id, email) : email) || '—'
  const cerrar = () => setAccion(null)
  const hecho = (texto) => { setAviso(texto); setAccion(null); onCambio?.() }
  const empezar = (tipo, caja) => () => { if (tipo !== 'historial') setAviso(''); setAccion({ tipo, caja }) }

  return (
    <div className="flex flex-col gap-3">
      {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {conFiltros && (
        <div role="group" aria-label="Filtrar cajas" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}
              className={cn('min-h-9 rounded-lg border px-3 text-xs transition-colors',
                filtro === f.id
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] font-bold text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] font-medium text-[hsl(var(--muted-foreground))]')}>
              {f.label} ({cuenta[f.id]})
            </button>
          ))}
        </div>
      )}
      {activas.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local no tiene cajas físicas activas.</p>
      ) : (
        <ul aria-label="Cajas del local" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((c) => {
            const nombre = c.name || 'Caja física'
            const ultimo = ultimoCierreDe(c)
            const actual = c.apertura_actual
            const enTurno = turnosPorCaja?.get(String(c.id)) ?? null
            const estado = (
              <Badge variant={c.abierta ? 'success' : 'destructive'} data-estado={c.abierta ? 'abierta' : 'cerrada'}>{c.abierta ? 'Abierta' : 'Cerrada'}</Badge>
            )
            if (c.abierta) {
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-t-4 border-[hsl(var(--border))] border-t-[hsl(var(--success))] bg-[hsl(var(--card))] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-bold text-[hsl(var(--foreground))]">{nombre}</span>
                    {estado}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <Dato etiqueta="Abrió">{actual ? persona(actual.abierta_por_user_id, actual.abierta_por_email) : '—'}</Dato>
                    <Dato etiqueta="Desde">{actual ? fechaHora(actual.abierta_at) : '—'}</Dato>
                    <Dato etiqueta="Fondo">{actual?.monto_apertura !== null && actual?.monto_apertura !== undefined ? formatMoney(Number(actual.monto_apertura)) : '—'}</Dato>
                    {enTurno !== null && <Dato etiqueta="En turno">{enTurno === 0 ? 'Nadie' : `${enTurno} persona${enTurno !== 1 ? 's' : ''}`}</Dato>}
                  </dl>
                  {puedeGestionar && (
                    <div className="mt-auto flex items-center gap-2">
                      <Button className="flex-1" onClick={empezar('cerrar', c)} aria-label={`Cerrar ${nombre}`}>
                        Cerrar caja
                      </Button>
                      <MasAcciones nombre={nombre} onMovimiento={empezar('movimiento', c)} onHistorial={empezar('historial', c)} />
                    </div>
                  )}
                </li>
              )
            }
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-l-4 border-[hsl(var(--border))] border-l-[hsl(var(--destructive))] bg-[hsl(var(--card))] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]">
                    <span className="truncate">{nombre}</span>
                    {estado}
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {ultimo ? `Último cierre: ${formatMoney(ultimo.contado)} el ${fechaHora(ultimo.cerradaAt)}` : 'Todavía no se ha abierto'}
                  </p>
                  {puedeGestionar && (
                    <button type="button" onClick={empezar('historial', c)} aria-label={`Historial de ${nombre}`}
                      className="text-xs font-semibold text-[hsl(var(--foreground))] underline underline-offset-2 hover:opacity-75">
                      Historial
                    </button>
                  )}
                </div>
                {puedeGestionar && (
                  <Button size="sm" onClick={empezar('abrir', c)} aria-label={`Abrir ${nombre}`}>
                    Abrir caja
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {accion?.tipo === 'abrir' && (
        <AbrirCajaFisica caja={accion.caja} localNombre={localNombre} nombreDe={nombreDe} onClose={cerrar}
          onAbierta={(a) => hecho(`${accion.caja.name || 'La caja'} quedó abierta con ${formatMoney(Number(a?.monto_apertura) || 0)}.`)} />
      )}
      {accion?.tipo === 'cerrar' && (
        <CerrarCajaFisica caja={accion.caja} localNombre={localNombre} cierra={cierra} nombreDe={nombreDe}
          onClose={() => { setAccion(null); onCambio?.() }}
          onCerrada={() => setAviso(`${accion.caja.name || 'La caja'} quedó cerrada.`)} />
      )}
      {accion?.tipo === 'movimiento' && (
        <MovimientoCajaFisica caja={accion.caja} onClose={cerrar}
          onRegistrado={({ tipo, monto }) => hecho(`${tipo === 'egreso' ? 'Retiro' : 'Ingreso'} de ${formatMoney(monto)} registrado en ${accion.caja.name || 'la caja'}.`)} />
      )}
      {accion?.tipo === 'historial' && <HistorialAperturas caja={accion.caja} nombreDe={nombreDe} onClose={cerrar} />}
    </div>
  )
}
