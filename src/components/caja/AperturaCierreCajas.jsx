import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { ultimoCierreDe } from '../../lib/cajaFisica'
import AbrirCajaFisica from './AbrirCajaFisica'
import CerrarCajaFisica from './CerrarCajaFisica'
import MovimientoCajaFisica from './MovimientoCajaFisica'
import HistorialAperturas from './HistorialAperturas'

/**
 * La caja del día (#133): cada caja física activa del local con su estado
 * (abierta desde cuándo y por quién, o cerrada con lo que dejó el último
 * cierre) y, para el encargado y el dueño, abrir, registrar un retiro o
 * ingreso, cerrar y ver el historial.
 */
export default function AperturaCierreCajas({ cajasFisicas = [], localNombre = '', cierra = '', puedeGestionar = false, nombreDe = null, onCambio }) {
  const [accion, setAccion] = useState(null) // { tipo: 'abrir' | 'cerrar' | 'movimiento' | 'historial', caja }
  const [aviso, setAviso] = useState('')
  const activas = (Array.isArray(cajasFisicas) ? cajasFisicas : []).filter((c) => c.is_active !== false)
  // Nombre de la persona (por su id o su correo); sin la lista de usuarios, el correo.
  const persona = (id, email) => (nombreDe ? nombreDe(id, email) : email) || '—'
  const cerrar = () => setAccion(null)
  const hecho = (texto) => { setAviso(texto); setAccion(null); onCambio?.() }

  return (
    <div className="flex flex-col gap-3">
      {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {activas.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local no tiene cajas físicas activas.</p>
      ) : (
        <ul aria-label="Cajas del local" className="flex flex-col gap-2">
          {activas.map((c) => {
            const ultimo = ultimoCierreDe(c)
            const actual = c.apertura_actual
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]">
                    {c.name || 'Caja física'}
                    <Badge variant={c.abierta ? 'success' : 'destructive'} data-estado={c.abierta ? 'abierta' : 'cerrada'}>{c.abierta ? 'Abierta' : 'Cerrada'}</Badge>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {c.abierta && actual
                      ? `Abierta el ${fechaHora(actual.abierta_at)} por ${persona(actual.abierta_por_user_id, actual.abierta_por_email)}${actual.monto_apertura !== null && actual.monto_apertura !== undefined ? ` · fondo ${formatMoney(Number(actual.monto_apertura))}` : ''}`
                      : ultimo ? `Último cierre: ${formatMoney(ultimo.contado)} el ${fechaHora(ultimo.cerradaAt)}` : 'Todavía no se ha abierto'}
                  </p>
                </div>
                {puedeGestionar && (
                  <div className="flex flex-wrap gap-2">
                    {c.abierta ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setAviso(''); setAccion({ tipo: 'movimiento', caja: c }) }} aria-label={`Retiro o ingreso en ${c.name || 'la caja'}`}>
                          Retiro o ingreso
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAviso(''); setAccion({ tipo: 'cerrar', caja: c }) }} aria-label={`Cerrar ${c.name || 'la caja'}`}>
                          Cerrar caja
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => { setAviso(''); setAccion({ tipo: 'abrir', caja: c }) }} aria-label={`Abrir ${c.name || 'la caja'}`}>
                        Abrir caja
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setAccion({ tipo: 'historial', caja: c })} aria-label={`Historial de ${c.name || 'la caja'}`}>
                      Historial
                    </Button>
                  </div>
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
