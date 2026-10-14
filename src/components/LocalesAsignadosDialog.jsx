import { useCallback, useEffect, useState } from 'react'
import { Store, Trash2, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  agregarLocal, filasDeLocales, listarLocalesAsignados, localesParaAgregar, quitarLocal,
} from '../lib/localesAsignados'

/** El texto del backend sin el "400: " del frente. */
const textoDeError = (e, porDefecto) => String(e?.detail || e?.message || porDefecto).replace(/^\d{3}:\s*/, '')

/**
 * Locales asignados a un administrador de local o un empleado (T-72). Lo usa
 * el dueño desde la gestión de usuarios: ve el local principal (marcado) y los
 * demás, agrega uno del negocio y quita los que sobran (con confirmación). El
 * principal no se quita desde aquí: es el local con que la persona entra.
 */
export default function LocalesAsignadosDialog({ usuario, locales = [], onClose }) {
  const [asignaciones, setAsignaciones] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [porQuitar, setPorQuitar] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let ignore = false
    listarLocalesAsignados(usuario.id)
      .then((filas) => { if (!ignore) setAsignaciones(filas) })
      .catch((e) => {
        if (ignore) return
        setAsignaciones([])
        setError(textoDeError(e, 'No se pudieron cargar los locales asignados'))
      })
    return () => { ignore = true }
  }, [usuario.id, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  const nombreDe = (id) => locales.find((l) => String(l.id) === String(id))?.name || `Local ${String(id).slice(0, 8)}…`
  const filas = filasDeLocales(asignaciones, { localPrincipalId: usuario.local_id, nombreDe })
  const opciones = localesParaAgregar(locales, asignaciones, { localPrincipalId: usuario.local_id })
  const nombrePersona = usuario.name || usuario.email

  const agregar = async () => {
    if (!nuevo) return
    setOcupado(true)
    setError('')
    try {
      await agregarLocal(usuario.id, nuevo, { localPrincipalId: usuario.local_id, asignaciones })
      setNuevo('')
      recargar()
    } catch (e) {
      setError(textoDeError(e, 'No se pudo asignar el local'))
      recargar()
    } finally {
      setOcupado(false)
    }
  }

  const quitar = async () => {
    if (!porQuitar) return
    setOcupado(true)
    setError('')
    try {
      await quitarLocal(usuario.id, porQuitar.asignacionId)
      setPorQuitar(null)
      recargar()
    } catch (e) {
      setError(textoDeError(e, 'No se pudo quitar el local'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Locales asignados</DialogTitle>
          <DialogDescription>
            {nombrePersona} puede trabajar en estos locales con la misma cuenta y cambiar de uno a otro.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {asignaciones === null ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando los locales…</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]" aria-label="Locales asignados">
            {filas.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">Todavía no tiene locales asignados.</li>
            )}
            {filas.map((f) => (
              <li key={f.localId} className="flex items-center gap-2 px-3 py-2.5">
                <Store size={14} className="shrink-0 text-[hsl(var(--primary))]" />
                <span className="flex-1 text-sm text-[hsl(var(--foreground))]">{f.nombre}</span>
                {f.principal ? (
                  <span className="rounded-full bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))]">Principal</span>
                ) : porQuitar?.asignacionId === f.asignacionId ? (
                  <span className="flex items-center gap-1.5">
                    <Button size="sm" variant="danger" onClick={quitar} disabled={ocupado}>Sí, quitar</Button>
                    <Button size="sm" variant="outline" onClick={() => setPorQuitar(null)} disabled={ocupado}>No</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setPorQuitar(f)} disabled={ocupado} aria-label={`Quitar ${f.nombre}`}>
                    <Trash2 size={13} /> Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {porQuitar && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            ¿Quitar {porQuitar.nombre}? {nombrePersona} ya no podrá cambiarse a ese local.
          </p>
        )}

        {asignaciones !== null && (
          opciones.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Ya tiene asignados todos los locales del negocio.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="local-para-agregar">Agregar un local</Label>
              <div className="flex gap-2">
                <select
                  id="local-para-agregar"
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  disabled={ocupado}
                  className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
                >
                  <option value="">Elige un local</option>
                  {opciones.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <Button onClick={agregar} disabled={ocupado || !nuevo}>
                  <Plus size={14} /> Agregar
                </Button>
              </div>
            </div>
          )
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose} disabled={ocupado}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
