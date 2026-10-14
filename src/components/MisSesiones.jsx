import { useEffect, useState } from 'react'
import { LogOut, Monitor } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fechaHora, listarMisSesiones, nombreDelDispositivo } from '../lib/sesiones'
import { Button } from './ui/button'

/** Quién puede cerrarle una sesión a esta persona (T-53): su encargado o el dueño. */
function avisoSegunRol(role) {
  const r = String(role || '').toUpperCase()
  if (r === 'EMPLEADO' || r === 'ADMIN') {
    return 'Si no reconoces alguna, avisa al encargado o al dueño: pueden cerrarla desde tu ficha. Cambiar tu contraseña también cierra las demás.'
  }
  return 'Si no reconoces alguna, cambia tu contraseña: eso cierra todas las demás sesiones.'
}

/**
 * "Mis sesiones" (T-74): en qué dispositivos está abierta la cuenta, para
 * detectar un acceso que la persona no reconoce. La actual aparece como
 * "Este dispositivo", con un botón para cerrarla (`POST /auth/logout`).
 */
export default function MisSesiones() {
  const { user, logout } = useAuth()
  const [sesiones, setSesiones] = useState(null) // null = cargando
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    listarMisSesiones()
      .then((filas) => { if (!ignore) setSesiones(filas) })
      .catch((e) => {
        if (ignore) return
        setSesiones([])
        setError(String(e?.detail || e?.message || 'No se pudieron cargar tus sesiones').replace(/^\d{3}:\s*/, ''))
      })
    return () => { ignore = true }
  }, [])

  if (sesiones === null) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando tus sesiones…</p>

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
      {!error && sesiones.length === 0 && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay sesiones abiertas para mostrar.</p>
      )}
      {sesiones.length > 0 && (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]" aria-label="Mis sesiones">
          {sesiones.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
              <Monitor size={18} className="hidden shrink-0 text-[hsl(var(--primary))] sm:block" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                  {nombreDelDispositivo(s)}
                  {s.es_actual && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Este dispositivo
                    </span>
                  )}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {s.ip ? `IP ${s.ip} · ` : ''}Última actividad: {fechaHora(s.last_seen_at)} · Vence: {fechaHora(s.expires_at)}
                </p>
              </div>
              {s.es_actual && (
                <Button type="button" variant="outline" size="sm" onClick={logout} className="gap-1.5 self-start sm:self-auto">
                  <LogOut size={14} /> Cerrar sesión en este dispositivo
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{avisoSegunRol(user?.role)}</p>
    </div>
  )
}
