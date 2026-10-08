import { useState } from 'react'
import { Loader2, Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCurrentBusiness } from '../hooks/useCurrentBusiness'
import { changeMyPassword } from '../lib/apiClient'
import { guardarMiNombre, tieneNombre, validarNombre } from '../lib/perfil'
import { formatRoleLabel } from '../auth/roleLabel'
import InicialesPerfil from './InicialesPerfil'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

const PLAN_LABEL = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Standard', basic: 'Standard' }

/**
 * Nombre y apellido reales, editables (`PATCH /auth/me`). Antes se mostraba
 * un nombre armado con el correo; si la persona todavía no cargó el suyo, se
 * la invita a completarlo.
 */
function NombreForm() {
  const { user, refreshUser } = useAuth()
  const [nombre, setNombre] = useState(user?.first_name || '')
  const [apellido, setApellido] = useState(user?.last_name || '')
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const sinCambios = nombre.trim() === (user?.first_name || '').trim() && apellido.trim() === (user?.last_name || '').trim()

  const guardar = async (e) => {
    e.preventDefault()
    setGuardado(false)
    const problema = validarNombre({ nombre, apellido })
    if (problema) { setError(problema); return }
    setError('')
    setGuardando(true)
    try {
      await guardarMiNombre({ nombre, apellido })
      await refreshUser()
      setGuardado(true)
    } catch (err) {
      setError(err?.message || 'No se pudo guardar tu nombre')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      {!tieneNombre(user) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          Todavía no cargaste tu nombre. Complétalo para que el equipo te reconozca en turnos, mesas y usuarios.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="perfil-nombre">Nombre</Label>
          <Input id="perfil-nombre" value={nombre} maxLength={100} autoComplete="given-name"
            onChange={(e) => { setNombre(e.target.value); setGuardado(false); setError('') }} disabled={guardando} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="perfil-apellido">Apellido</Label>
          <Input id="perfil-apellido" value={apellido} maxLength={100} autoComplete="family-name"
            onChange={(e) => { setApellido(e.target.value); setGuardado(false); setError('') }} disabled={guardando} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
      {guardado && <p className="text-sm text-emerald-600 dark:text-emerald-400">Nombre guardado</p>}
      <Button type="submit" disabled={guardando || sinCambios} className="gap-2">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar nombre
      </Button>
    </form>
  )
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    try {
      await changeMyPassword({ current_password: currentPassword, new_password: newPassword })
      setSuccess('Contraseña actualizada correctamente')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.detail || err.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
      <Button type="submit" disabled={submitting} className="gap-2">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Cambiar contraseña
      </Button>
    </form>
  )
}

function AppearanceToggle() {
  const { darkMode, setDarkMode } = useTheme()

  const applyMode = (dark) => {
    setDarkMode(dark)
    try {
      document.documentElement.classList.toggle('dark', dark)
      window.localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      // localStorage puede fallar en modo privado — no crítico, el toggle en memoria ya se aplicó
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={!darkMode ? 'default' : 'outline'}
        onClick={() => applyMode(false)}
        className="gap-2"
      >
        <Sun className="h-4 w-4" /> Claro
      </Button>
      <Button
        type="button"
        variant={darkMode ? 'default' : 'outline'}
        onClick={() => applyMode(true)}
        className="gap-2"
      >
        <Moon className="h-4 w-4" /> Oscuro
      </Button>
    </div>
  )
}

function ConfiguracionPage() {
  const { user, userRole } = useAuth()
  const { business } = useCurrentBusiness()
  const planLabel = business?.plan ? (PLAN_LABEL[business.plan] || business.plan) : null

  return (
    <div className="min-h-full bg-[hsl(var(--background))] px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-marca text-3xl text-[hsl(var(--foreground))] tracking-tight">Configuración</h1>
          <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            Tu perfil, seguridad y preferencias de la cuenta.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Tu nombre y los datos de tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <InicialesPerfil user={user} className="h-24 w-24 text-3xl" />
            <div className="flex-1 w-full space-y-4">
              <NombreForm key={user?.id} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Correo</p>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{user?.email}</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Plan</p>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{planLabel || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Cargo</p>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{user?.cargo || formatRoleLabel(userRole)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
            <CardDescription>Cambiá la contraseña de tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription>Modo claro u oscuro para toda la aplicación.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceToggle />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ConfiguracionPage
