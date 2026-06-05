import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLocals } from '../hooks/useLocals'
import { isSuperAdminRole } from '../auth/roleLabel'
import { WORKER_ROLES } from '../constants/roles'

const STEPS = {
  // Paso 1: grid de locales (navega al primer local al hacer Siguiente)
  // Pasos 2-5: ítems del sidebar (visibles una vez dentro de un local)
  superadmin: [
    {
      target: 'locales-grid',
      title: 'Tus Locales',
      desc: 'Aquí ves todos tus locales. Presiona Siguiente y entraremos al primero para mostrarte el resto.',
      navigateToFirstLocal: true,
    },
    {
      target: 'nav-usuarios',
      title: 'Gestión de Usuarios',
      desc: 'Crea y administra el equipo asignando roles: Empleado, Admin o Superadmin.',
    },
    {
      target: 'nav-dashboard',
      title: 'Dashboard del Local',
      desc: 'Métricas en tiempo real: ventas del día, stock crítico, hora pico y comparativos semanales.',
    },
    {
      target: 'nav-administracion',
      title: 'Administración',
      desc: 'Flujo de caja, rendiciones, reportes y bonos de cada local desde aquí.',
    },
    {
      target: 'nav-inventario',
      title: 'Inventario',
      desc: 'Controla stock, proveedores, pedidos de insumos y gestiona las recetas del menú.',
    },
  ],
  admin: [
    {
      target: 'dashboard-ventas-card',
      title: 'Ventas del Día',
      desc: 'Ingresos del día en tiempo real. Incluye ticket promedio y tasa de cancelación.',
    },
    {
      target: 'nav-administracion',
      title: 'Administración',
      desc: 'Revisa flujo de caja, rendiciones, alertas y bonos de tu local.',
    },
    {
      target: 'nav-pos',
      title: 'POS Restaurante',
      desc: 'Gestiona las mesas y las órdenes activas. La vista cocina avanza los pedidos en curso.',
    },
    {
      target: 'nav-inventario',
      title: 'Inventario',
      desc: 'Controla stock, proveedores, pedidos de insumos y gestiona las recetas del menú.',
    },
  ],
  worker: [
    {
      target: 'pos-mesas-grid',
      title: 'Mesas del Local',
      desc: 'Toca una mesa libre (verde) para crear una nueva orden y agregar los ítems del pedido.',
    },
    {
      target: 'pos-kitchen-btn',
      title: 'Vista Cocina',
      desc: 'Aquí la cocina ve y avanza las órdenes en curso. Puedes consultarlo en cualquier momento.',
    },
  ],
}

const OnboardingContext = createContext(null)

export function OnboardingProvider({ children }) {
  const { user, userRole } = useAuth()
  const navigate = useNavigate()
  const { locales } = useLocals()
  const [step, setStep] = useState(0)
  const [active, setActive] = useState(false)

  const storageKey = user?.id ? `siba_onboarding_${user.id}` : null

  const steps = isSuperAdminRole(userRole)
    ? STEPS.superadmin
    : WORKER_ROLES.includes(userRole)
    ? STEPS.worker
    : STEPS.admin

  useEffect(() => {
    if (!storageKey || !userRole) return
    const done = localStorage.getItem(storageKey)
    if (!done) {
      const t = setTimeout(() => setActive(true), 900)
      return () => clearTimeout(t)
    }
  }, [storageKey, userRole])

  const next = useCallback(() => {
    const currentStep = steps[step]

    // Si el paso actual pide navegar al primer local, hacerlo antes de avanzar
    if (currentStep?.navigateToFirstLocal && locales?.length > 0) {
      const first = locales[0]
      navigate(`/local/${first.id}/dashboard`, { state: { local: first } })
    }

    if (step >= steps.length - 1) {
      setActive(false)
      if (storageKey) localStorage.setItem(storageKey, '1')
    } else {
      setStep((s) => s + 1)
    }
  }, [step, steps, storageKey, locales, navigate])

  const skip = useCallback(() => {
    setActive(false)
    if (storageKey) localStorage.setItem(storageKey, '1')
  }, [storageKey])

  useEffect(() => {
    if (active) setStep(0)
  }, [active])

  return (
    <OnboardingContext.Provider value={{ active, step, steps, next, skip }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
