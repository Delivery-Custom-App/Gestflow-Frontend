import { useState } from 'react'
import { Eye, EyeOff, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

export default function RegisterPage({ onShowLogin }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    businessName: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) return setError('El nombre es requerido')
    if (!form.email.trim()) return setError('El correo es requerido')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (form.password !== form.confirmPassword) return setError('Las contraseñas no coinciden')

    setIsLoading(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          business_name: form.businessName.trim() || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.detail || `Error ${res.status}`)
      }

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const bgStyle = {
    backgroundImage: "url('/sibaritco-logo.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: '40%',
    backgroundAttachment: 'fixed',
  }

  if (success) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center gap-7 px-4 py-10" style={bgStyle}>
        <div className="pointer-events-none absolute inset-0 bg-white/92" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[hsl(var(--primary))]">SibaGestion</h1>
        </div>
        <section className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--primary-border,150,50%,75%))] bg-white/80 p-8 shadow-xl backdrop-blur-sm text-center flex flex-col gap-4">
          <div className="text-5xl text-[hsl(var(--primary))]">✓</div>
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">¡Cuenta creada con éxito!</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Tu cuenta ha sido registrada. Ya puedes iniciar sesión con tu correo y contraseña.
          </p>
          <Button onClick={onShowLogin} className="mt-2 h-11">
            Ir al inicio de sesión
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-7 px-4 py-10" style={bgStyle}>
      <div className="pointer-events-none absolute inset-0 bg-white/92" />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] shadow-lg">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[hsl(var(--primary))]">SibaGestion</h1>
        <p className="text-base text-[hsl(var(--primary))]">Sistema de Gestión Integral</p>
      </div>

      <section
        aria-label="Formulario de registro"
        className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--primary-border,150,50%,75%))] bg-white/80 p-7 shadow-xl backdrop-blur-sm"
      >
        <h2 className="mb-5 text-center text-2xl font-bold text-[hsl(var(--foreground))]">Crear Cuenta</h2>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-name">Nombre completo *</Label>
            <Input
              id="reg-name"
              name="name"
              type="text"
              placeholder="Juan Pérez"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-email">Correo Electrónico *</Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              placeholder="usuario@empresa.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-business">Nombre del Negocio</Label>
            <Input
              id="reg-business"
              name="businessName"
              type="text"
              placeholder="Ej: Restaurante El Buen Sabor"
              value={form.businessName}
              onChange={handleChange}
              disabled={isLoading}
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Opcional — puedes configurarlo después</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-password">Contraseña *</Label>
            <div className="relative">
              <Input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-45"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-confirm">Confirmar Contraseña *</Label>
            <Input
              id="reg-confirm"
              name="confirmPassword"
              type="password"
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="mt-1 h-12 text-base" disabled={isLoading}>
            {isLoading ? 'Creando cuenta...' : 'Registrarse'}
          </Button>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>

        <div className="mt-5 text-center">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">¿Ya tienes una cuenta? </span>
          <button
            type="button"
            onClick={onShowLogin}
            className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Iniciar sesión
          </button>
        </div>
      </section>
    </main>
  )
}
