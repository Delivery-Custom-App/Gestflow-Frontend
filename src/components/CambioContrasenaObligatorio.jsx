import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeMyPassword } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'

const MINIMO = 8

/**
 * Cambio de contraseña obligatorio (#29).
 *
 * Cuando el backend marca `must_change_password`, bloquea toda la API menos
 * el login, /auth/me y este cambio: cualquier otra pantalla respondería 403.
 * Por eso esto se muestra en lugar de la aplicación, sin cambiar la URL — al
 * terminar, la persona sigue justo donde iba.
 */
export default function CambioContrasenaObligatorio() {
  const { user, refreshUser, logout } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!actual) { setError('Escribe la contraseña con la que entraste'); return }
    if (nueva.length < MINIMO) { setError(`La contraseña nueva necesita al menos ${MINIMO} caracteres`); return }
    if (nueva !== repetida) { setError('Las dos contraseñas nuevas no coinciden'); return }
    if (nueva === actual) { setError('La contraseña nueva tiene que ser distinta de la actual'); return }

    setGuardando(true)
    setError('')
    try {
      await changeMyPassword({ current_password: actual, new_password: nueva })
      // El backend limpia el flag y lo relee en vivo en cada petición: el
      // mismo token queda desbloqueado, no hace falta entrar de nuevo.
      await refreshUser()
    } catch (e) {
      const mensaje = String(e?.message || '')
      setError(/contraseña actual incorrecta/i.test(mensaje)
        ? 'La contraseña actual no es correcta.'
        : (mensaje || 'No se pudo cambiar la contraseña'))
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
            <KeyRound className="h-5 w-5 text-[hsl(var(--primary))]" />
          </span>
          <div>
            <h1 className="text-base font-bold text-[hsl(var(--foreground))]">Cambia tu contraseña</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {user?.email ? `${user.email} · ` : ''}entraste con una contraseña temporal
            </p>
          </div>
        </div>

        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">
          Antes de seguir tienes que elegir una contraseña propia. Hasta entonces el sistema no te
          deja operar.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pass-actual">Contraseña actual</Label>
            <Input id="pass-actual" type="password" value={actual} autoComplete="current-password"
              onChange={(e) => setActual(e.target.value)} disabled={guardando} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pass-nueva">Contraseña nueva</Label>
            <Input id="pass-nueva" type="password" value={nueva} autoComplete="new-password"
              onChange={(e) => setNueva(e.target.value)} disabled={guardando} />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Al menos {MINIMO} caracteres.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pass-repetida">Repite la contraseña nueva</Label>
            <Input id="pass-repetida" type="password" value={repetida} autoComplete="new-password"
              onChange={(e) => setRepetida(e.target.value)} disabled={guardando} />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" onClick={logout} disabled={guardando}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40">
              Cerrar sesión
            </button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
