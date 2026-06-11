import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLocals } from '../hooks/useLocals'
import { isSuperAdminRole } from '../auth/roleLabel'
import { WORKER_ROLES } from '../constants/roles'

const STEPS = {
  superadmin: [
    {
      target: 'locales-grid',
      title: 'Tus Franquicias',
      desc: 'Gestiona todas tus franquicias. Usa "Crear Franquicia" para agregar una nueva o "Opciones" para configurar umbrales de flujo y eliminar locales.',
    },
    {
      target: 'nav-dashboard',
      title: 'Dashboard del Local',
      desc: 'Métricas en tiempo real: ventas del día, stock crítico, hora pico y comparativos semanales.',
    },
    {
      target: 'nav-usuarios',
      title: 'Gestión de Usuarios',
      desc: 'Crea y administra el equipo asignando roles: Empleado, Admin o Superadmin.',
    },
    {
      target: 'nav-administracion',
      title: 'Administración',
      desc: 'Flujo de caja, rendiciones, reportes y bonos de cada local desde aquí.',
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

// Superadmin: ruta al LLEGAR a cada paso
const getSuperadminArrivalRoute = (step, localId) => {
  const map = {
    1: localId ? `/local/${localId}/dashboard` : null,
    2: '/usuarios',
    3: localId ? `/local/${localId}/dashboard` : null,
    4: localId ? `/local/${localId}/dashboard` : null,
    5: localId ? `/local/${localId}/dashboard` : null,
  }
  return map[step] ?? null
}

// Admin: los pasos 1-3 del sidebar necesitan dashboard base (accordion cerrado)
const getAdminArrivalRoute = (step, localId) => {
  const map = {
    1: localId ? `/local/${localId}/dashboard` : null,
    2: localId ? `/local/${localId}/dashboard` : null,
    3: localId ? `/local/${localId}/dashboard` : null,
  }
  return map[step] ?? null
}

const OnboardingContext = createContext(null)

export function OnboardingProvider({ children }) {
  const { user, userRole, assignedLocalId } = useAuth()
  const navigate = useNavigate()
  const { locales } = useLocals()
  const [step, setStep] = useState(0)
  const [active, setActive] = useState(false)
  const localIdRef = useRef(null)

  const storageKey = user?.id ? `siba_onboarding_${user.id}` : null
  const isSuperadmin = isSuperAdminRole(userRole)
  const isAdmin = !isSuperadmin && !WORKER_ROLES.includes(userRole)

  const steps = isSuperadmin
    ? STEPS.superadmin
    : WORKER_ROLES.includes(userRole)
    ? STEPS.worker
    : STEPS.admin

  // Para superadmin: captura el localId del primer local via API
  // Para admin: usa su local asignado del JWT
  useEffect(() => {
    if (assignedLocalId && !localIdRef.current) {
      localIdRef.current = assignedLocalId
    }
  }, [assignedLocalId])

  useEffect(() => {
    if (locales?.length > 0 && !localIdRef.current) {
      localIdRef.current = locales[0].id
    }
  }, [locales])

  // Detecta primera sesión — marca como visto al arrancar para que no repita aunque cierren a mitad
  useEffect(() => {
    if (!storageKey || !userRole) return
    const done = localStorage.getItem(storageKey)
    if (!done) {
      const t = setTimeout(() => {
        localStorage.setItem(storageKey, '1')
        setActive(true)
      }, 900)
      return () => clearTimeout(t)
    }
  }, [storageKey, userRole])

  // Navega al LLEGAR a cada paso (superadmin y admin)
  useEffect(() => {
    if (!active) return
    const localId = localIdRef.current
    let route = null
    if (isSuperadmin) {
      route = getSuperadminArrivalRoute(step, localId)
    } else if (isAdmin) {
      route = getAdminArrivalRoute(step, localId)
    }
    if (route) navigate(route)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step])

  const next = useCallback(() => {
    if (step >= steps.length - 1) {
      setActive(false)
    } else {
      setStep((s) => s + 1)
    }
  }, [step, steps.length])

  const skip = useCallback(() => {
    setActive(false)
  }, [])

  const restart = useCallback(() => {
    setStep(0)
    setActive(true)
  }, [])

  useEffect(() => {
    if (active) setStep(0)
  }, [active])

  return (
    <OnboardingContext.Provider value={{ active, step, steps, next, skip, restart }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
