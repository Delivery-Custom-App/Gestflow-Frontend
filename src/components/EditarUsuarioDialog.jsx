import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROL_LABEL, rolConLocal, rolesAsignables } from '../lib/altaUsuario'
import {
  actualizarUsuario, cambiosDeEdicion, formularioDe, puedeCambiarRolYLocal, textoDeError, validarEdicion,
} from '../lib/gestionUsuarios'

const selectCls = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40'

/**
 * Editar a una persona (T-32): nombre y apellido; el dueño y el superadmin
 * también cambian el rol y el local. Un encargado o vendedor siempre lleva
 * local: sin él no se deja guardar. Solo se manda lo que cambió.
 */
export default function EditarUsuarioDialog({ usuario, locales = [], miRol, onClose, onGuardado }) {
  const [form, setForm] = useState(() => formularioDe(usuario))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conRolYLocal = puedeCambiarRolYLocal(miRol)
  const roles = rolesAsignables(miRol)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    const problema = validarEdicion(form)
    if (problema) { setError(problema); return }
    const cambios = cambiosDeEdicion(usuario, form, { conRolYLocal })
    if (Object.keys(cambios).length === 0) { onClose(); return }
    setGuardando(true)
    setError('')
    try {
      await actualizarUsuario(usuario.id, cambios)
      onGuardado()
    } catch (err) {
      setError(textoDeError(err, 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-nombre">Nombre</Label>
              <Input id="ed-nombre" value={form.nombre} onChange={set('nombre')} disabled={guardando} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-apellido">Apellido</Label>
              <Input id="ed-apellido" value={form.apellido} onChange={set('apellido')} disabled={guardando} />
            </div>
          </div>
          {conRolYLocal && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-rol">Rol</Label>
                <select id="ed-rol" value={form.role} onChange={set('role')} disabled={guardando} className={selectCls}>
                  {(roles.includes(form.role) ? roles : [form.role, ...roles]).map((r) => (
                    <option key={r} value={r}>{ROL_LABEL[r] || r}</option>
                  ))}
                </select>
              </div>
              {rolConLocal(form.role) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ed-local">Local</Label>
                  <select id="ed-local" value={form.local_id} onChange={set('local_id')} disabled={guardando} className={selectCls}>
                    <option value="">Selecciona un local</option>
                    {locales.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando…</span> : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
