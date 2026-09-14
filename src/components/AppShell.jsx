import { useState, useEffect, useMemo } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'
import { useCurrentBusiness } from '../hooks/useCurrentBusiness'
import { useTheme } from '../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Store, ChevronDown, ChevronLeft, ChevronRight,
  DollarSign, FileText, BarChart3, Wallet,
  Table2, ChefHat, Moon, Sun, UserCircle2,
  Package, Truck, ShoppingCart, BookMarked, PackageOpen, UtensilsCrossed,
  LogOut, Users, RotateCcw, MapPin, Building2, Settings,
} from 'lucide-react'
import AunaroSymbol from '@/assets/brand/AunaroSymbol'
import { displayNameFromEmail } from '@/lib/v2SuperAdminAdapter'

const ROLE_BADGE_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMINNEGOCIO: 'Gerente',
  ADMIN: 'Administrador',
  EMPLEADO: 'Empleado',
}

const PLAN_BADGE_LABEL = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Standard', basic: 'Standard' }
import CoachMark from './onboarding/CoachMark'
import { useOnboarding } from '../context/OnboardingContext'
import { isSuperAdminRole, isAdminNegocioRole, normalizeRoleKey } from '../auth/roleLabel'
import { WORKER_ROLES } from '../constants/roles'
import { isDirectSaleDemoUser } from '../constants/demoMode'
import { formatShortAddress } from '../lib/formatAddress'
import { isV2FeatureEnabled } from '../lib/v2Features'
import { isAlPasoLocal } from '../lib/salesModel'

/* ── key sets for accordion auto-open ──────────────────────────── */
const ADMIN_KEYS = new Set(['administracion', 'ventas', 'flujo-caja'])
const POS_KEYS   = new Set(['pos', 'pos-mesas', 'pos-kitchen', 'pos-venta-directa'])
const INV_KEYS   = new Set(['inv-hub', 'inv-prov', 'inv-stock', 'inv-stock-ctrl', 'inv-compras', 'inv-recetas'])

/* ── active-key derived from pathname ──────────────────────────── */
function deriveActiveKey(pathname) {
  if (pathname.includes('/inventario/proveedores'))       return 'inv-prov'
  if (pathname.includes('/inventario/stock-control'))     return 'inv-stock-ctrl'
  if (pathname.includes('/inventario/stock'))             return 'inv-stock'
  if (pathname.includes('/inventario/compras-semanales')) return 'inv-compras'
  if (pathname.includes('/inventario/recipes'))           return 'inv-recetas'
  if (pathname.includes('/inventario'))                   return 'inv-hub'
  if (pathname.includes('/pos/venta-directa'))            return 'pos-venta-directa'
  if (pathname.includes('/pos/cocina'))                   return 'pos-kitchen'
  if (pathname.includes('/pos'))                          return 'pos-mesas'
  if (pathname.includes('/administrativo/ventas'))        return 'ventas'
  if (pathname.includes('/administrativo/flujo-caja'))    return 'flujo-caja'
  if (pathname.includes('/administrativo'))               return 'administracion'
  if (pathname.includes('/rrhh'))                         return 'hr-hub'
  if (pathname.includes('/usuarios'))                    return 'usuarios'
  if (pathname.includes('/gestor/resumen'))              return 'gestor-resumen'
  if (pathname.includes('/gestor/negocios'))             return 'gestor'
  if (pathname.includes('/gestor/auditoria'))            return 'gestor-auditoria'
  if (pathname.includes('/gestor/usuarios'))             return 'gestor-usuarios'
  if (pathname.includes('/gestor/observabilidad'))       return 'gestor-observabilidad'
  if (pathname.includes('/gestor'))                      return 'gestor'
  if (pathname.includes('/dashboard'))                    return 'dashboard'
  return 'locales'
}

/* ── nav config ─────────────────────────────────────────────────── */
const ACCORDIONS = [
  {
    key: 'administracion',
    label: 'Administración',
    icon: Wallet,
    items: [
      { key: 'ventas',      label: 'Ventas',        icon: DollarSign },
      { key: 'flujo-caja',  label: 'Caja Virtual',  icon: Wallet     },
    ],
  },
  {
    key: 'pos',
    label: 'POS Restaurante',
    icon: Table2,
    items: [
      { key: 'pos-mesas',   label: 'Gestión de Mesas', icon: Table2  },
      { key: 'pos-kitchen', label: 'Cocina',            icon: ChefHat },
    ],
  },
  {
    key: 'inventario',
    label: 'Inventario',
    icon: PackageOpen,
    items: [
      { key: 'inv-hub',        label: 'Estado Inventario', icon: PackageOpen  },
      { key: 'inv-prov',       label: 'Proveedores',       icon: Truck        },
      { key: 'inv-stock',      label: 'Menú',              icon: UtensilsCrossed },
      { key: 'inv-stock-ctrl', label: 'Control de stock',  icon: Package      },
      { key: 'inv-compras',    label: 'Pedidos',           icon: ShoppingCart },
      { key: 'inv-recetas',    label: 'Recetas',           icon: BookMarked   },
    ],
  },
]

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle, onClose }) {
  const { user, userRole, logout } = useAuth()
  const { restart: restartTour } = useOnboarding()
  const { business } = useCurrentBusiness()
  const isSuperAdmin = isSuperAdminRole(userRole)
  const isOwner = isAdminNegocioRole(userRole)
  const isWorker = WORKER_ROLES.includes(userRole)
  const isDemoUser = isDirectSaleDemoUser(user?.email)
  const { locales } = useLocals()
  const navigate = useNavigate()
  const { pathname, state: locState } = useLocation()

  const localIdMatch = pathname.match(/\/local\/([^/]+)/)
  const localId  = localIdMatch ? localIdMatch[1] : null
  const currentLocal = useMemo(
    () => locales.find((l) => String(l.id) === String(localId)) || locState?.local || null,
    [locales, localId, locState],
  )
  const isAlPaso = isAlPasoLocal(currentLocal) || isDemoUser
  const activeKey = deriveActiveKey(pathname)
  const navState  = locState?.local ? { local: locState.local } : localId ? { local: { id: localId } } : {}

  const [userOpen, setUserOpen] = useState({ administracion: false, pos: false, inventario: false })
  const [userClosed, setUserClosed] = useState({ administracion: false, pos: false, inventario: false })

  const isOpen = (key) => {
    if (userClosed[key]) return false
    if (key === 'administracion' && ADMIN_KEYS.has(activeKey)) return true
    if (key === 'pos'            && POS_KEYS.has(activeKey))   return true
    if (key === 'inventario'     && INV_KEYS.has(activeKey))   return true
    return userOpen[key] ?? false
  }

  const toggleAccordion = (key) => {
    const open = isOpen(key)
    if (open) {
      setUserClosed(p => ({ ...p, [key]: true }))
      setUserOpen(p => ({ ...p, [key]: false }))
    } else {
      setUserClosed(p => ({ ...p, [key]: false }))
      setUserOpen(p => ({ ...p, [key]: true }))
    }
  }

  const goAccordion = (key) => {
    if (!localId) return
    switch (key) {
      case 'administracion': navigate(`/local/${localId}/administrativo/ventas`, { state: navState }); break
      case 'pos':            navigate(isAlPaso ? `/local/${localId}/pos/venta-directa` : `/local/${localId}/pos`, { state: navState }); break
      case 'inventario':     navigate(`/local/${localId}/inventario`, { state: navState }); break
      default: break
    }
  }

  const goItem = (item) => {
    onClose?.()
    switch (item.key) {
      case 'locales':   navigate('/admin'); break
      case 'usuarios':  navigate('/usuarios'); break
      case 'gestor':    navigate('/gestor'); break
      case 'gestor-resumen':       navigate('/gestor/resumen'); break
      case 'gestor-auditoria':     navigate('/gestor/auditoria'); break
      case 'gestor-usuarios':      navigate('/gestor/usuarios'); break
      case 'gestor-observabilidad': navigate('/gestor/observabilidad'); break
      case 'dashboard': navigate(localId ? `/local/${localId}/dashboard` : '/admin', { state: navState }); break
      case 'hr-hub':    if (localId) navigate(`/local/${localId}/rrhh`, { state: navState }); break
      case 'pos-mesas':     if (localId) navigate(`/local/${localId}/pos`, { state: navState }); break
      case 'pos-kitchen':   if (localId) navigate(`/local/${localId}/pos/cocina`, { state: navState }); break
      case 'pos-venta-directa': if (localId) navigate(`/local/${localId}/pos/venta-directa`, { state: navState }); break
      case 'inv-hub':       if (localId) navigate(`/local/${localId}/inventario`, { state: navState }); break
      case 'inv-prov':      if (localId) navigate(`/local/${localId}/inventario/proveedores`, { state: navState }); break
      case 'inv-stock':     if (localId) navigate(`/local/${localId}/inventario/stock`, { state: navState }); break
      case 'inv-stock-ctrl': if (localId) navigate(`/local/${localId}/inventario/stock-control`, { state: navState }); break
      case 'inv-compras':   if (localId) navigate(`/local/${localId}/inventario/compras-semanales`, { state: navState }); break
      case 'inv-recetas':   if (localId) navigate(`/local/${localId}/inventario/recipes`, { state: navState }); break
      default:
        if (ADMIN_KEYS.has(item.key) && localId)
          navigate(`/local/${localId}/administrativo/${item.key}`, { state: navState })
    }
  }

  const discoverItems = [
    ...(isOwner ? [{ key: 'locales', label: 'Tus franquicias', icon: Store }] : []),
    ...(isSuperAdmin ? [{ key: 'gestor', label: 'Gestor de Negocios', icon: Building2 }] : []),
    ...(isSuperAdmin ? [{ key: 'gestor-resumen', label: 'Resumen Global', icon: LayoutDashboard }] : []),
    ...(isSuperAdmin ? [{ key: 'gestor-usuarios', label: 'Usuarios', icon: Users }] : []),
    ...(isSuperAdmin ? [{ key: 'gestor-auditoria', label: 'Auditoría', icon: FileText }] : []),
    ...(isSuperAdmin ? [{ key: 'gestor-observabilidad', label: 'Observabilidad', icon: BarChart3 }] : []),
    ...(isOwner ? [{ key: 'usuarios', label: 'Usuarios', icon: Users }] : []),
    ...(isOwner && isV2FeatureEnabled('hrModule') && !localId ? [{ key: 'hr-hub', label: 'Recursos Humanos', icon: Users, disabled: true }] : []),
    ...(isV2FeatureEnabled('hrModule') && localId ? [{ key: 'hr-hub', label: 'RRHH', icon: Users }] : []),
    ...(!isWorker && localId ? [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
  ]

  // Comida al paso (sales_model AL_PASO) o demo legacy por email:
  // caja + menú, sin mesas/cocina.
  const AL_PASO_POS_ITEMS = [
    { key: 'pos-venta-directa', label: 'Venta directa', icon: DollarSign },
  ]
  const WORKER_FINANCE_ITEM_KEYS = new Set(['ventas'])
  const visibleAccordions = isWorker
    ? (isAlPaso
        ? ACCORDIONS
            .filter((s) => s.key === 'pos' || s.key === 'administracion')
            .map((s) => s.key === 'pos'
              ? { ...s, label: 'Punto de venta', items: AL_PASO_POS_ITEMS }
              : { ...s, label: 'Finanzas', items: s.items.filter((i) => WORKER_FINANCE_ITEM_KEYS.has(i.key)) })
        : ACCORDIONS.filter((s) => s.key === 'pos'))
    : isAlPaso
      ? ACCORDIONS.map((s) => {
          if (s.key === 'pos') return { ...s, label: 'Punto de venta', items: AL_PASO_POS_ITEMS }
          if (s.key === 'inventario') {
            return {
              ...s,
              items: s.items.filter((i) => i.key === 'inv-stock' || i.key === 'inv-hub' || i.key === 'inv-stock-ctrl'),
            }
          }
          return s
        })
      : ACCORDIONS

  const navBtn = (item, small = false, hideIcon = false) => {
    const isActive = activeKey === item.key
    const Icon = item.icon
    const isDisabled = item.disabled === true
    return (
      <button
        key={item.key}
        data-onboarding={`nav-${item.key}`}
        onClick={() => !isDisabled && goItem(item)}
        title={collapsed ? item.label : undefined}
        disabled={isDisabled}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 rounded-lg font-medium transition-colors text-left',
          small ? 'py-1.5 text-sm' : 'py-2.5 text-sm',
          isDisabled
            ? 'text-[hsl(var(--muted-foreground))] cursor-not-allowed opacity-50'
            : isActive
              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
          collapsed && 'justify-center px-0',
        )}
      >
        {(!hideIcon || collapsed) && <Icon size={small ? 14 : 16} className="shrink-0" />}
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="truncate flex items-center gap-1.5"
            >
              {item.label}
              {isDisabled && <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">pronto</span>}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    )
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 90 : 240 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="shrink-0 flex flex-col bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] h-screen sticky top-0 overflow-hidden z-20"
    >
      {/* Header */}
      <div className={cn('border-b border-[hsl(var(--border))] flex items-center', collapsed ? 'justify-center gap-1.5 px-1 py-2.5 translate-x-2.5' : 'justify-between px-3 min-h-[56px]')}>
        {collapsed ? (
          <AunaroSymbol size={20} className="shrink-0" />
        ) : (
          <div className="flex items-center gap-2 px-1">
            <AunaroSymbol size={20} className="shrink-0" />
            <span className="font-marca text-sm tracking-[0.1em] text-[hsl(var(--foreground))]">AUNARO</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors shrink-0"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Perfil: badges de rol/plan + avatar */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-3 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 mb-3">
            {userRole && (
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-indigo-500/80 text-white">
                {ROLE_BADGE_LABEL[normalizeRoleKey(userRole)] || userRole}
              </span>
            )}
            {business?.plan && (
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-emerald-500 text-white">
                {PLAN_BADGE_LABEL[business.plan] || business.plan}
              </span>
            )}
          </div>
          <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center mb-2.5 shrink-0" style={{ backgroundColor: '#fff' }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircle2 className="h-11 w-11 text-slate-700" strokeWidth={1.5} />
            )}
          </div>
          <p className="font-marca text-base text-[hsl(var(--foreground))] truncate max-w-full">
            {displayNameFromEmail(user?.email)}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 no-scrollbar">
        {/* DESCUBRIR */}
        <div className="mb-3">
          {discoverItems.length > 0 && (
            <>
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="px-3 pb-1.5 text-xs text-[hsl(var(--muted-foreground))]"
                  >
                    Descubrir
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}

          <div className={cn('rounded-xl border border-[hsl(var(--border))] flex flex-col gap-0.5', collapsed ? 'p-1' : 'p-1.5')}>
            {discoverItems.map((item) => navBtn(item, false, true))}

            {/* Configuración */}
            <button
              onClick={() => { onClose?.(); navigate('/configuracion') }}
              title={collapsed ? 'Configuración' : undefined}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 rounded-lg font-medium transition-colors text-left py-2.5 text-sm',
                pathname === '/configuracion'
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                collapsed ? 'justify-center px-0' : null,
              )}
            >
              {collapsed && <Settings size={16} className="shrink-0" />}
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 text-left">
                    Configuración
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Accordions: menú + submenú expansible */}
        {localId && visibleAccordions.map((section) => {
          const open = isOpen(section.key)
          const hasActive = activeKey === section.key || section.items.some((i) => activeKey === i.key)
          const Icon = section.icon
          return (
            <div key={section.key} className="mb-1">
              <div className="flex items-center gap-0">
                <button
                  data-onboarding={`nav-${section.key}`}
                  onClick={() => {
                    if (collapsed) { onToggle(); setUserOpen((p) => ({ ...p, [section.key]: true })) }
                    else goAccordion(section.key)
                  }}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    'flex-1 flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors',
                    hasActive
                      ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                    collapsed ? 'justify-center px-0 rounded-lg' : 'rounded-l-lg',
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 truncate text-left"
                      >
                        {section.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                {!collapsed && (
                  <button
                    onClick={() => toggleAccordion(section.key)}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 shrink-0 rounded-r-lg transition-colors',
                      hasActive
                        ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-center"
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {open && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pl-3 py-1 flex flex-col gap-0.5">
                      {section.items.map((item) => navBtn(item, true))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 border-t border-[hsl(var(--border))] pt-3">
        <button
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90 transition-opacity',
            collapsed ? 'justify-center px-0' : 'justify-center',
          )}
        >
          {collapsed && <LogOut size={16} className="shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Wordmark de marca */}
        {!collapsed && (
          <div className="mt-4 flex flex-col items-center text-center gap-1">
            <AunaroSymbol size={28} />
            <span className="font-marca text-sm tracking-widest text-[hsl(var(--foreground))]">AUNARO</span>
            <p className="text-[10px] italic text-[hsl(var(--muted-foreground))]">Inteligencia de negocios en tus manos</p>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
              © {new Date().getFullYear()} Mardev. Todos los derechos reservados.
            </p>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

/* ── TopBar ─────────────────────────────────────────────────────── */
function TopBar({ localId }) {
  const { locales } = useLocals()
  const { business } = useCurrentBusiness()
  const { darkMode, setDarkMode } = useTheme()
  const { state: locState } = useLocation()

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    try {
      document.documentElement.classList.toggle('dark', next)
      window.localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
  }

  const selectedLocal = useMemo(() => {
    if (!localId) return null
    if (locState?.local?.name) return locState.local
    return locales.find((l) => String(l.id) === String(localId)) ?? null
  }, [localId, locState, locales])

  return (
    <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm z-10">
      {/* Left: local name + address */}
      <div className="min-w-0">
        {selectedLocal ? (
          <>
            <h1 className="text-sm font-bold text-[hsl(var(--foreground))] leading-tight truncate">
              {selectedLocal.name}
            </h1>
            {selectedLocal.address && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 truncate">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{formatShortAddress(selectedLocal.address)}</span>
              </p>
            )}
          </>
        ) : business?.name ? (
          <h1 className="font-marca text-lg text-[hsl(var(--foreground))] truncate">{business.name}</h1>
        ) : (
          <span className="font-marca text-sm tracking-[0.1em] text-[hsl(var(--foreground))]">AUNARO</span>
        )}
      </div>

      {/* Right: dark mode toggle */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          className="w-9 h-9 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          {darkMode ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
    </div>
  )
}

/* ── AppShell ───────────────────────────────────────────────────── */
function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem('appSidebarCollapsed') === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const { pathname } = useLocation()
  const localIdMatch = pathname.match(/\/local\/([^/]+)/)
  const localId = localIdMatch ? localIdMatch[1] : null

  /* Cierra el drawer móvil al cambiar de ruta */
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleToggle = () => {
    setCollapsed((v) => {
      const next = !v
      try { window.localStorage.setItem('appSidebarCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[var(--loading-from)] via-[var(--loading-via)] to-[var(--loading-to)]">

      {/* Overlay backdrop (solo móvil) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — overlay en móvil, sticky en desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out',
          'md:relative md:z-auto md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Sidebar
          collapsed={mobileOpen ? false : collapsed}
          onToggle={handleToggle}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[hsl(var(--background))]">
        <TopBar localId={localId} />
        <Outlet />
      </div>

      <CoachMark />
    </div>
  )
}

export default AppShell
