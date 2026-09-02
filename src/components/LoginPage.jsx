import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../context/AuthContext'
import AunaroSymbol from '@/assets/brand/AunaroSymbol'

export default function LoginPage({ onShowRegister }) {
  const { login } = useAuth()
  const {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    errorMessage,
    successMessage,
    handleSubmit,
  } = login

  const [showPassword, setShowPassword] = useState(false)

  return (
    <motion.main
      className="login-light min-h-screen bg-[#F7F5F0] text-[#0D0D1F]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_500px]">
        <section className="relative hidden overflow-hidden bg-[#0D0D1F] text-white lg:flex lg:flex-col lg:justify-between">
          <img
            src="/people-taking-photos-food.jpg"
            alt="Equipo fotografiando platos en una mesa"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D1F]/85 via-[#0D0D1F]/45 to-[#0D0D1F]/20" />
          <div className="relative z-10 flex items-center gap-3 p-10">
            <AunaroSymbol size={40} />
            <span className="font-marca text-xl tracking-[0.14em] text-white">AUNARO</span>
          </div>
          <div className="relative z-10 max-w-2xl p-10 pb-16">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[hsl(var(--primary-tint))]">Restaurantes · POS · Operación</p>
            <h1 className="mt-4 max-w-[11ch] font-marca text-6xl font-black leading-[0.95] tracking-[-0.02em] xl:text-7xl">Tu local en orden, todos los días.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">Controla mesas, carta, inventario y pagos desde una vista simple para equipos reales en hora punta.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Pedidos claros', 'Caja conectada', 'Carta actualizada'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary-tint))]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <AunaroSymbol size={40} />
              <div>
                <p className="font-marca text-lg tracking-[0.14em] text-[#0D0D1F]">AUNARO</p>
                <p className="text-sm font-medium text-[#0D0D1F]/60">Control de tus locales</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(var(--primary))]">Acceso operativo</p>
              <h2 className="mt-3 font-marca text-4xl font-black tracking-[-0.01em] text-[#0D0D1F]">Ingresa a tu panel</h2>
              <p className="mt-3 text-base leading-7 text-[#0D0D1F]/70">Usa tus credenciales para continuar con la gestión del local.</p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-bold text-[#0D0D1F]/80">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@empresa.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              className="h-12 rounded-xl border-2 border-[#0D0D1F]/15 bg-white text-base font-semibold text-[#0D0D1F] shadow-sm placeholder:text-[#0D0D1F]/40 focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/0.15)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-sm font-bold text-[#0D0D1F]/80">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-2 border-[#0D0D1F]/15 bg-white pr-11 text-base font-semibold text-[#0D0D1F] shadow-sm placeholder:text-[#0D0D1F]/40 focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/0.15)]"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#0D0D1F]/40 transition-colors hover:text-[#0D0D1F] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="mt-2 h-12 rounded-xl border-0 bg-[hsl(var(--primary))] text-base font-black text-[hsl(var(--primary-foreground))] shadow-lg shadow-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.9)]" disabled={isLoading || !email || !password}>
            {isLoading ? 'Validando...' : <span className="inline-flex items-center gap-2">Entrar <ArrowRight className="h-4 w-4" /></span>}
          </Button>

          {errorMessage && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          )}
        </form>
        {import.meta.env.DEV && (
          <p className="mt-5 text-center text-xs text-[#0D0D1F]/45">
            Tras iniciar sesión, recetas (práctica):{' '}
            <a
              href="/practica/recetas"
              className="font-bold text-[hsl(var(--primary))] underline"
            >
              /practica/recetas
            </a>
          </p>
        )}

        {onShowRegister && (
          <div className="mt-5 text-center">
            <span className="text-sm text-[#0D0D1F]/60">¿No tienes una cuenta? </span>
            <button
              type="button"
              onClick={onShowRegister}
              className="text-sm font-bold text-[hsl(var(--primary))] hover:underline"
            >
              Regístrate aquí
            </button>
          </div>
        )}
          </div>
        </section>
      </div>
    </motion.main>
  )
}
