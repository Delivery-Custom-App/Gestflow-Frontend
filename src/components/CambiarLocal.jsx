import { useEffect, useState } from 'react'
import { ArrowLeftRight, Store } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useTurnoVendedor } from '../context/turnoVendedor'
import { cambiarLocalActivo } from '../lib/authClient'
import {
  listarLocalesAsignados, nombreRecordadoDeLocal, puedeTenerVariosLocales, recordarNombreDeLocal,
} from '../lib/localesAsignados'

const textoDeError = (e) => String(e?.detail || e?.message || 'No se pudo cambiar de local').replace(/^\d{3}:\s*/, '')

/**
 * "Cambiar de local" (T-73): para el administrador de local o el empleado con
 * más de un local asignado. Elige otro y la sesión sigue, con el token nuevo
 * de `POST /auth/switch-local`; después se vuelve a leer el usuario (su
 * `local_id` cambió) y la página se recarga en el inicio del local nuevo: así
 * mesas, turno, menú, stock y las listas guardadas en memoria se piden de
 * nuevo con el token nuevo (y funciona también en "¿Iniciar turno?", que se
 * muestra fuera del router). Con un turno abierto en el local actual se avisa
 * antes de cambiar. Con un solo local no se muestra nada.
 *
 * `alCambiar`: qué hacer después de cambiar (por defecto, recargar en "/").
 */
const recargarEnInicio = () => window.location.replace('/')

export default function CambiarLocal({ alCambiar = recargarEnInicio }) {
  const { user, refreshUser } = useAuth()
  const turnoVendedor = useTurnoVendedor()
  const [asignaciones, setAsignaciones] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [destino, setDestino] = useState(null) // local elegido, pendiente de confirmar por el turno abierto
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState('')
  const aplica = puedeTenerVariosLocales(user?.role)

  // El nombre del local activo se recuerda para mostrarlo cuando esté en otro.
  useEffect(() => { recordarNombreDeLocal(user?.local_id, user?.local_name) }, [user?.local_id, user?.local_name])

  useEffect(() => {
    if (!aplica || !user?.id) return undefined
    let ignore = false
    listarLocalesAsignados(user.id)
      .then((filas) => { if (!ignore) setAsignaciones(filas) })
      // Sin la lista no se ofrece cambiar: no se inventan locales.
      .catch(() => { if (!ignore) setAsignaciones([]) })
    return () => { ignore = true }
  }, [aplica, user?.id, user?.local_id])

  const otros = asignaciones.filter((a) => String(a.local_id) !== String(user?.local_id))
  if (!aplica || otros.length === 0) return null

  const nombreDe = (id) => nombreRecordadoDeLocal(id) || 'Otro local asignado'
  const actual = user?.local_name || nombreDe(user?.local_id)
  const turnoAbierto = Boolean(turnoVendedor?.turno)

  const cerrar = () => { if (cambiando) return; setAbierto(false); setDestino(null); setError('') }

  const cambiar = async (localId) => {
    setCambiando(true)
    setError('')
    try {
      await cambiarLocalActivo(localId)
      // Deja guardado el usuario con el local nuevo antes de recargar.
      await refreshUser()
      alCambiar(localId)
    } catch (e) {
      setError(textoDeError(e))
      setCambiando(false)
    }
  }

  const elegir = (localId) => {
    if (turnoAbierto) { setDestino(localId); return }
    cambiar(localId)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
        aria-label={`Cambiar de local (ahora: ${actual})`}
      >
        <ArrowLeftRight size={13} className="shrink-0" />
        <span className="truncate">{actual}</span>
      </button>

      {abierto && (
        <Dialog open onOpenChange={(v) => { if (!v) cerrar() }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Cambiar de local</DialogTitle>
              <DialogDescription>Ahora trabajas en {actual}. Tu sesión sigue abierta en el local que elijas.</DialogDescription>
            </DialogHeader>
            <DialogBody>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">{error}</p>
            )}

            {destino ? (
              <div className="flex flex-col gap-3">
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                  Tienes un turno abierto en {actual}. Sigue abierto aunque te cambies: termínalo o pide al
                  encargado que lo cierre cuando corresponda.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDestino(null)} disabled={cambiando}>Volver</Button>
                  <Button onClick={() => cambiar(destino)} disabled={cambiando}>
                    {cambiando ? 'Cambiando…' : `Cambiarme a ${nombreDe(destino)}`}
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Mis locales">
                {otros.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => elegir(a.local_id)}
                      disabled={cambiando}
                      className="flex w-full items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3 text-left hover:bg-[hsl(var(--muted)/0.4)] transition-colors disabled:opacity-50"
                    >
                      <Store size={16} className="shrink-0 text-[hsl(var(--primary))]" />
                      <span className="flex-1 text-sm font-medium text-[hsl(var(--foreground))]">{nombreDe(a.local_id)}</span>
                      {a.is_primary && <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Principal</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
