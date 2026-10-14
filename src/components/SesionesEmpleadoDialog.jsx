import { useCallback, useEffect, useState } from 'react'
import { LogOut, Monitor } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  MOTIVO_SESION_MAX, cerrarSesionesDe, fechaHora, listarSesionesDe, nombreDelDispositivo, textoDelCierre,
  validarMotivoSesion,
} from '../lib/sesiones'

const textoDeError = (e, porDefecto) => String(e?.detail || e?.message || porDefecto).replace(/^\d{3}:\s*/, '')

/**
 * Sesiones de una persona (T-53): en qué dispositivos está conectada, con
 * «Cerrar sesión» por dispositivo o «Cerrar todas» (siempre con motivo), y el
 * historial de cierres con «Ver cerradas». Lo usan el encargado (empleados de
 * su local) y el dueño (su negocio), por ejemplo si alguien perdió el celular.
 * Cerrar la sesión no termina el turno ni suelta la máquina.
 */
export default function SesionesEmpleadoDialog({ usuario, onClose, nombreDeUsuario = (id) => `Usuario ${String(id).slice(0, 8)}…` }) {
  const [sesiones, setSesiones] = useState(null) // null = cargando
  const [verCerradas, setVerCerradas] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cerrando, setCerrando] = useState(null) // { sessionId|null, nombre }
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [intento, setIntento] = useState(0)
  const nombre = usuario.name || usuario.email

  useEffect(() => {
    let ignore = false
    listarSesionesDe(usuario.id, { incluirCerradas: verCerradas })
      .then((filas) => { if (!ignore) setSesiones(filas) })
      .catch((e) => {
        if (ignore) return
        setSesiones([])
        setError(textoDeError(e, 'No se pudieron cargar las sesiones'))
      })
    return () => { ignore = true }
  }, [usuario.id, verCerradas, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  const abiertas = (sesiones || []).filter((s) => s.activa !== false)
  const cerradas = (sesiones || []).filter((s) => s.activa === false)

  const confirmarCierre = async (e) => {
    e.preventDefault()
    const problema = validarMotivoSesion(motivo)
    if (problema) { setError(problema); return }
    setOcupado(true)
    setError('')
    try {
      const r = await cerrarSesionesDe(usuario.id, { motivo, sessionId: cerrando.sessionId })
      const n = Number(r?.cerradas) || 0
      setAviso(n === 1 ? 'Se cerró 1 sesión.' : `Se cerraron ${n} sesiones.`)
      setCerrando(null)
      setMotivo('')
      recargar()
    } catch (err) {
      setError(textoDeError(err, 'No se pudo cerrar la sesión'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sesiones de {nombre}</DialogTitle>
          <DialogDescription>
            Dispositivos donde tiene la sesión abierta. Cerrar una sesión no termina su turno ni suelta su máquina.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}

        {sesiones === null ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las sesiones…</p>
        ) : (
          <>
            {abiertas.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No tiene sesiones abiertas.</p>
            ) : (
              <ul aria-label="Sesiones abiertas" className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]">
                {abiertas.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Monitor size={16} className="shrink-0 text-[hsl(var(--primary))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{nombreDelDispositivo(s)}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {s.ip ? `IP ${s.ip} · ` : ''}Última actividad: {fechaHora(s.last_seen_at)} · Vence: {fechaHora(s.expires_at)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled={ocupado}
                      onClick={() => { setCerrando({ sessionId: s.id, nombre: nombreDelDispositivo(s) }); setError(''); setAviso('') }}
                      aria-label={`Cerrar la sesión de ${nombreDelDispositivo(s)}`}>
                      <LogOut size={13} /> Cerrar sesión
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {abiertas.length > 1 && !cerrando && (
              <Button variant="danger" size="sm" className="self-start" disabled={ocupado}
                onClick={() => { setCerrando({ sessionId: null, nombre: 'todas' }); setError(''); setAviso('') }}>
                Cerrar todas
              </Button>
            )}

            {cerrando && (
              <form onSubmit={confirmarCierre} className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3">
                <Label htmlFor="motivo-cierre-sesion">
                  {cerrando.sessionId ? `Motivo para cerrar la sesión de ${cerrando.nombre}` : 'Motivo para cerrar todas sus sesiones'}
                </Label>
                <textarea id="motivo-cierre-sesion" rows={2} maxLength={MOTIVO_SESION_MAX} value={motivo}
                  onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} placeholder="Ej: Perdió el celular"
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{nombre} recibirá un aviso con este motivo.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setCerrando(null); setMotivo('') }} disabled={ocupado}>Cancelar</Button>
                  <Button type="submit" variant="danger" size="sm" disabled={ocupado}>{ocupado ? 'Cerrando…' : 'Confirmar cierre'}</Button>
                </div>
              </form>
            )}

            <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <input type="checkbox" checked={verCerradas} onChange={(e) => setVerCerradas(e.target.checked)} />
              Ver cerradas
            </label>
            {verCerradas && (
              cerradas.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No hay sesiones cerradas.</p>
              ) : (
                <ul aria-label="Sesiones cerradas" className="max-h-48 divide-y divide-[hsl(var(--border))] overflow-y-auto rounded-lg border border-[hsl(var(--border))]">
                  {cerradas.map((s) => (
                    <li key={s.id} className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium text-[hsl(var(--foreground))]">{nombreDelDispositivo(s)}</span>
                      {' · '}{textoDelCierre(s)} el {fechaHora(s.revoked_at)}
                      {s.revoked_by_user_id ? ` · Por ${nombreDeUsuario(s.revoked_by_user_id)}` : ''}
                      {s.revoked_reason ? ` · Motivo: ${s.revoked_reason}` : ''}
                    </li>
                  ))}
                </ul>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
