import { useRef, useState } from 'react'
import { Camera, Loader2, Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCurrentBusiness } from '../hooks/useCurrentBusiness'
import { changeMyPassword, updateMyAvatar } from '../lib/apiClient'
import { displayNameFromEmail } from '../lib/v2SuperAdminAdapter'
import { formatRoleLabel } from '../auth/roleLabel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

const PLAN_LABEL = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Standard', basic: 'Standard' }

const AVATAR_MAX_DIMENSION = 160
const AVATAR_JPEG_QUALITY = 0.82

/** Redimensiona/comprime la imagen en el navegador antes de subirla como data URL. */
function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      img.onerror = () => reject(new Error('Archivo de imagen inválido'))
      img.onload = () => {
        const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function AvatarSection() {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Elegí un archivo de imagen (JPG, PNG, etc.)')
      return
    }
    setError('')
    setUploading(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      await updateMyAvatar(dataUrl)
      await refreshUser()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la foto de perfil')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative h-24 w-24 rounded-full overflow-hidden group shrink-0 cursor-pointer disabled:cursor-wait"
        style={{ backgroundColor: '#fff' }}
        title="Cambiar foto de perfil"
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400 text-2xl font-bold">
            {displayNameFromEmail(user?.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Hacé clic en la foto para cambiarla</p>
      {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
    </div>
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
            <CardDescription>Foto, nombre y datos de tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <AvatarSection />
            <div className="flex-1 w-full space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Nombre</p>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{displayNameFromEmail(user?.email)}</p>
              </div>
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
