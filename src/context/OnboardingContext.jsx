import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLocals } from '../hooks/useLocals'
import { isSuperAdminRole } from '../auth/roleLabel'
import { WORKER_ROLES } from '../constants/roles'

// getPath recibe el localId del primer local y devuelve la ruta a navegar al avanzar ese paso
const STEPS = {
  superadmin: [
    {
      target: 'locales-grid',
      title: 'Tus Locales',
      desc: 'Aquí ves todos tus locales. Presiona Siguiente y entraremos al primero para mostrarte el resto.',
      getPath: (localId) => `/local/${localId}/dashboard`,
    },
    {
      target: 'nav-usuarios',
      title: 'Gestión de Usuarios',
      desc: 'Crea y administra el equipo asignando roles: Empleado, Admin o Superadmin.',
      getPath: () => '/usuarios',
    },
    {
      target: 'nav-dashboard',
      title: 'Dashboard del Local',
      desc: 'Métricas en tiempo real: ventas del día, stock crítico, hora pico y comparativos semanales.',
      getPath: (localId) => `/local/${localId}/dashboard`,
    },
    {
      target: 'nav-administracion',
      title: 'Administración',
      desc: 'Flujo de caja, rendiciones, reportes y bonos de cada local desde aquí.',
      getPath: (localId) => `/local/${localId}/administrativo/ventas`,
    },
    {
      target: 'nav-inventario',
      title: 'Inventario',
      desc: 'Controla stock, proveedores, pedidos de insumos y gestiona las recetas del menú.',
      // último paso — no navega, solo cierra
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
      getPath: (localId) => `/local/${localId}/administrativo/ventas`,
    },
    {
      target: 'nav-pos',
      title: 'POS Restaurante',
      desc: 'Gestiona las mesas y las órdenes activas. La vista cocina avanza los pedidos en curso.',
      getPath: (localId) => `/local/${localId}/pos`,
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
  // Guardamos el localId del primer local cuando se navega en paso 1
  const localIdRef = useRef(null)

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

  // Captura el localId del primer local cuando esté disponible
  useEffect(() => {
    if (locales?.length > 0 && !localIdRef.current) {
      localIdRef.current = locales[0].id
    }
  }, [locales])

  const next = useCallback(() => {
    const currentStep = steps[step]
    const localId = localIdRef.current

    // Navegar si el paso define getPath (excepto el último paso)
    if (currentStep?.getPath && localId) {
      const path = currentStep.getPath(localId)
      if (path) navigate(path)
    }

    if (step >= steps.length - 1) {
      setActive(false)
      if (storageKey) localStorage.setItem(storageKey, '1')
    } else {
      setStep((s) => s + 1)
    }
  }, [step, steps, storageKey, navigate])

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
