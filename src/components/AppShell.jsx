import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'
import { useTheme } from '../context/ThemeContext'
import { useAlerts } from '../hooks/useAlerts'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Store, ChevronDown, ChevronLeft, ChevronRight,
  DollarSign, FileText, BarChart3, Wallet, Bell, Gift,
  Table2, ChefHat,
  Package, Truck, ShoppingCart, BookMarked, PackageOpen,
  LogOut, Utensils, HelpCircle, Phone, Mail, Moon, Sun, Users, RotateCcw, MapPin,
} from 'lucide-react'
import CoachMark from './onboarding/CoachMark'
import { useOnboarding } from '../context/OnboardingContext'
import { isSuperAdminRole } from '../auth/roleLabel'

/* ── key sets for accordion auto-open ──────────────────────────── */
const ADMIN_KEYS = new Set(['administracion', 'ventas', 'rendiciones', 'reportes', 'flujo-caja', 'alertas', 'bonos'])
const POS_KEYS   = new Set(['pos', 'pos-mesas', 'pos-kitchen'])
const INV_KEYS   = new Set(['inv-hub', 'inv-prov', 'inv-stock', 'inv-compras', 'inv-recetas'])

/* ── active-key derived from pathname ──────────────────────────── */
function deriveActiveKey(pathname) {
  if (pathname.includes('/inventario/proveedores'))       return 'inv-prov'
  if (pathname.includes('/inventario/stock'))             return 'inv-stock'
  if (pathname.includes('/inventario/compras-semanales')) return 'inv-compras'
  if (pathname.includes('/inventario/recipes'))           return 'inv-recetas'
  if (pathname.includes('/inventario'))                   return 'inv-hub'
  if (pathname.includes('/pos/cocina'))                   return 'pos-kitchen'
  if (pathname.includes('/pos'))                          return 'pos-mesas'
  if (pathname.includes('/administrativo/ventas'))        return 'ventas'
  if (pathname.includes('/administrativo/rendiciones'))   return 'rendiciones'
  if (pathname.includes('/administrativo/reportes'))      return 'reportes'
  if (pathname.includes('/administrativo/flujo-caja'))    return 'flujo-caja'
  if (pathname.includes('/administrativo/alertas'))       return 'alertas'
  if (pathname.includes('/administrativo/bonos'))         return 'bonos'
  if (pathname.includes('/administrativo'))               return 'administracion'
  if (pathname.includes('/usuarios'))                    return 'usuarios'
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
      { key: 'rendiciones', label: 'Rendiciones',   icon: FileText   },
      { key: 'reportes',    label: 'Reportes',      icon: BarChart3  },
      { key: 'flujo-caja',  label: 'Caja Virtual',  icon: Wallet     },
      { key: 'alertas',     label: 'Alertas',       icon: Bell       },
      { key: 'bonos',       label: 'Bonos',         icon: Gift       },
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
      { key: 'inv-hub',     label: 'Estado Actual Inventario', icon: PackageOpen  },
      { key: 'inv-prov',    label: 'Proveedores',              icon: Truck        },
      { key: 'inv-stock',   label: 'Stock de productos',       icon: Package      },
      { key: 'inv-compras', label: 'Pedidos',                  icon: ShoppingCart },
      { key: 'inv-recetas', label: 'Recetas',                  icon: BookMarked   },
    ],
  },
]

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle, onClose }) {
  const { user, userRole, logout } = useAuth()
  const { restart: restartTour } = useOnboarding()
  const isSuperAdmin = isSuperAdminRole(userRole)
  const navigate = useNavigate()
  const { pathname, state: locState } = useLocation()
  const { locales } = useLocals()

  const localIdMatch = pathname.match(/\/local\/([^/]+)/)
  const localId  = localIdMatch ? localIdMatch[1] : null
  const activeKey = deriveActiveKey(pathname)
  const navState  = locState?.local ? { local: locState.local } : localId ? { local: { id: localId } } : {}

  const selectedLocal = useMemo(() => {
    if (!localId) return null
    if (locState?.local?.name) return locState.local
    return locales.find((l) => String(l.id) === String(localId)) ?? null
  }, [localId, locState, locales])

  const [helpOpen, setHelpOpen] = useState(false)
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
      case 'pos':            navigate(`/local/${localId}/pos`, { state: navState }); break
      case 'inventario':     navigate(`/local/${localId}/inventario`, { state: navState }); break
      default: break
    }
  }

  const goItem = (item) => {
    onClose?.()
    switch (item.key) {
      case 'locales':   navigate('/admin'); break
      case 'usuarios':  navigate('/usuarios'); break
      case 'dashboard': navigate(localId ? `/local/${localId}/dashboard` : '/admin', { state: navState }); break
      case 'pos-mesas':     if (localId) navigate(`/local/${localId}/pos`, { state: navState }); break
      case 'pos-kitchen':   if (localId) navigate(`/local/${localId}/pos/cocina`, { state: navState }); break
      case 'inv-hub':       if (localId) navigate(`/local/${localId}/inventario`, { state: navState }); break
      case 'inv-prov':      if (localId) navigate(`/local/${localId}/inventario/proveedores`, { state: navState }); break
      case 'inv-stock':     if (localId) navigate(`/local/${localId}/inventario/stock`, { state: navState }); break
      case 'inv-compras':   if (localId) navigate(`/local/${localId}/inventario/compras-semanales`, { state: navState }); break
      case 'inv-recetas':   if (localId) navigate(`/local/${localId}/inventario/recipes`, { state: navState }); break
      default:
        if (ADMIN_KEYS.has(item.key) && localId)
          navigate(`/local/${localId}/administrativo/${item.key}`, { state: navState })
    }
  }

  const discoverItems = [
    ...(isSuperAdmin ? [{ key: 'locales', label: 'Tus Franquicias', icon: Store }] : []),
    ...(isSuperAdmin ? [{ key: 'usuarios', label: 'Usuarios', icon: Users }] : []),
    ...(localId ? [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
  ]

  const navBtn = (item, small = false) => {
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
          small ? 'py-1.5 text-sm' : 'py-2 text-sm',
          isDisabled
            ? 'text-white/30 cursor-not-allowed opacity-50'
            : isActive
              ? 'bg-white/20 text-white'
              : 'text-white/75 hover:bg-white/15 hover:text-white',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon size={small ? 14 : 16} className="shrink-0" />
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
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="shrink-0 flex flex-col bg-[hsl(var(--primary))] text-white h-screen sticky top-0 overflow-hidden z-20"
    >
      {/* Header */}
      <div className={cn('border-b border-white/15', collapsed ? 'flex items-center justify-center px-2 min-h-[60px]' : 'px-4 pt-3 pb-3')}>
        <div className={cn('flex items-center gap-2', collapsed ? '' : 'w-full')}>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="logo-text"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                {/* Marca */}
                <div className="flex items-center gap-2 mb-1">
                  <Utensils size={18} className="shrink-0" />
                  <span className="font-extrabold text-sm tracking-tight">SibaGestion</span>
                </div>
                {/* Local activo */}
                {selectedLocal && (
                  <div className="rounded-md bg-white/10 px-2 py-1.5 mt-1">
                    <p className="text-[11px] font-semibold text-white leading-tight truncate">
                      {selectedLocal.name}
                    </p>
                    {selectedLocal.address && (
                      <p className="flex items-start gap-1 mt-0.5">
                        <MapPin size={9} className="shrink-0 mt-0.5 text-white/50" />
                        <span className="text-[9px] text-white/50 leading-tight line-clamp-2">{selectedLocal.address}</span>
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/15 transition-colors shrink-0"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 no-scrollbar">
        {/* DESCUBRIR */}
        <div className="mb-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-3 pb-1 text-[10px] font-bold text-white/40 uppercase tracking-widest"
              >
                DESCUBRIR
              </motion.p>
            )}
          </AnimatePresence>
          {discoverItems.map((item) => navBtn(item))}
        </div>

        {/* Accordions */}
        {localId && ACCORDIONS.map((section) => {
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
                    hasActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/15 hover:text-white',
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
                      hasActive ? 'bg-white/20 text-white hover:bg-white/30' : 'text-white/60 hover:bg-white/15 hover:text-white',
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
      <div className="px-2 pb-4 border-t border-white/15 pt-3">
        {/* Replay tutorial button */}
        <button
          onClick={() => { onClose?.(); restartTour() }}
          title={collapsed ? 'Ver tutorial' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/15 hover:text-white transition-colors mb-1',
            collapsed && 'justify-center px-0',
          )}
        >
          <RotateCcw size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 text-left">
                Ver tutorial
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Help button */}
        <button
          onClick={() => { if (collapsed) { onToggle(); setHelpOpen(true) } else { setHelpOpen((v) => !v) } }}
          title={collapsed ? 'Ayuda' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/15 hover:text-white transition-colors mb-1',
            collapsed && 'justify-center px-0',
          )}
        >
          <HelpCircle size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 text-left">
                Ayuda
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Help panel */}
        <AnimatePresence>
          {helpOpen && !collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-2"
            >
              <div className="rounded-lg bg-white/10 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Soporte</span>
                  <span className="text-[9px] font-bold bg-amber-400/90 text-amber-900 px-1.5 py-0.5 rounded-full tracking-wide">DEMO</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Phone size={12} className="shrink-0 text-white/40" />
                  <span className="text-xs">+56 9 1234 5678</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Mail size={12} className="shrink-0 text-white/40" />
                  <span className="text-xs truncate">soporte@sibagestion.cl</span>
                </div>
                <p className="text-[10px] text-white/30 pt-1 border-t border-white/10">
                  Versión demo — solo fines de prueba
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-3 py-2 mb-2 rounded-lg bg-white/10"
            >
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{userRole || 'Usuario'}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-red-500/20 hover:text-red-200 transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}

/* ── AlertBell ──────────────────────────────────────────────────── */
function AlertBell({ localId }) {
  const navigate = useNavigate()
  const { pathname, state: locState } = useLocation()
  const { pendingCount } = useAlerts(localId)

  if (!localId) return null

  const navState = locState?.local ? { local: locState.local } : { local: { id: localId } }
  const isActive = pathname.includes('/administrativo/alertas')

  return (
    <button
      onClick={() => navigate(`/local/${localId}/administrativo/alertas`, { state: navState })}
      title={pendingCount > 0 ? `${pendingCount} alerta(s) pendiente(s)` : 'Alertas'}
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
        isActive
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
      )}
    >
      <Bell size={18} />
      {pendingCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
    </button>
  )
}

/* ── AppShell ───────────────────────────────────────────────────── */
function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem('appSidebarCollapsed') === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const { darkMode, toggleDarkMode } = useTheme()

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
    <div className="flex h-screen bg-[hsl(var(--background))]">

      {/* Controles flotantes — portal directo al body, inmune a cualquier transform */}
      <FloatingControls localId={localId} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

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
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </div>

      <CoachMark />
    </div>
  )
}

function FloatingControls({ localId, darkMode, toggleDarkMode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(
    <div style={{ position: 'fixed', top: '8px', right: '12px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '4px' }}>
      {localId && <AlertBell localId={localId} />}
      <button
        onClick={toggleDarkMode}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'hsl(var(--muted-foreground))' }}
        title={darkMode ? 'Modo claro' : 'Modo noche'}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>,
    document.body
  )
}

export default AppShell
