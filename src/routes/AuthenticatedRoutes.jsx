import { lazy, Suspense, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router'
import AppShell from '../components/AppShell'
import ErrorBoundary from '../components/ErrorBoundary'
import LoadingPage from '../components/LoadingPage'

// Carga diferida (code-splitting): cada página se compila en su propio chunk y
// se descarga solo cuando se navega a su ruta. Saca del bundle inicial el código
// pesado (recharts en dashboards/inventario, módulos admin), reduciendo el bundle
// principal y el tiempo de carga del POS (AC2, AC3).
const AdminDashboard = lazy(() => import('../components/AdminDashboard'))
const LocalDashboard = lazy(() => import('../components/LocalDashboard'))
const AdministrativeModule = lazy(() => import('../components/AdministrativeModule'))
const InventoryHub = lazy(() => import('../components/inventory/InventoryHub'))
const StockControlDashboard = lazy(() => import('../components/inventory/StockControlDashboard'))
const MenuBuilderPage = lazy(() => import('../components/inventory/MenuBuilderPage'))
const SuppliersKpisDashboard = lazy(() => import('../components/inventory/SuppliersKpisDashboard'))
const WeeklyPurchasesPage = lazy(() => import('../components/inventory/weeklyPurchases/WeeklyPurchasesPage'))
const WeeklyPurchaseDetailPage = lazy(() => import('../components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage'))
const RecipesPage = lazy(() => import('../components/inventory/recipes/RecipesPage'))
const POSModule = lazy(() => import('../components/pos/POSModule'))
const HrModule = lazy(() => import('../components/hr/HrModule'))
const MesaDetail = lazy(() => import('../components/pos/MesaDetail'))
const ReportesPage = lazy(() => import('../components/pos/ReportesPage'))
const VentaDirectaView = lazy(() => import('../components/pos/VentaDirectaView'))
const UserManagementPage = lazy(() => import('../components/UserManagementPage'))
const UsersListPage = lazy(() => import('../components/UsersListPage'))
const TenantManagerPage = lazy(() => import('../components/TenantManagerPage'))
const TenantManagerDashboardPage = lazy(() => import('../components/TenantManagerDashboardPage'))
const TenantDetailPage = lazy(() => import('../components/TenantDetailPage'))
const GlobalAuditPage = lazy(() => import('../components/GlobalAuditPage'))
const AdminUsersPage = lazy(() => import('../components/AdminUsersPage'))
const ObservabilityPage = lazy(() => import('../components/ObservabilityPage'))
const ConfiguracionPage = lazy(() => import('../components/ConfiguracionPage'))
import { OnboardingProvider } from '../context/OnboardingContext'
import { WORKER_ROLES } from '../constants/roles'
import { isSuperAdminRole, isAdminNegocioRole } from '../auth/roleLabel'
import { isDirectSaleDemoUser } from '../constants/demoMode'
import { isAlPasoLocal } from '../lib/salesModel'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'

function AdminLayout() {
  return <AppShell />
}

function useLocalIsAlPaso(localId) {
  const { user } = useAuth()
  const { locales } = useLocals()
  return useMemo(() => {
    if (isDirectSaleDemoUser(user?.email)) return true
    const local = locales.find((l) => String(l.id) === String(localId))
    return isAlPasoLocal(local)
  }, [locales, localId, user?.email])
}

/** Si el local es comida al paso, /pos (mesas) redirige a venta directa. */
function RestaurantPosOrRedirect() {
  const { localId } = useParams()
  const alPaso = useLocalIsAlPaso(localId)
  if (alPaso) return <Navigate to={`/local/${localId}/pos/venta-directa`} replace />
  return <POSModule />
}

function LocalModulesHomeRedirect() {
  const { localId } = useParams()
  const { state } = useLocation()
  return <Navigate to={`/local/${localId}/dashboard`} replace state={state ?? {}} />
}

function LegacyComprasRedirect() {
  const { localId } = useParams()
  return <Navigate to={`/local/${localId}/inventario/compras-semanales`} replace />
}

function LegacyComprasDetailRedirect() {
  const { localId, orderId } = useParams()
  return <Navigate to={`/local/${localId}/inventario/compras-semanales/${orderId}`} replace />
}

/**
 * Defense-in-depth: bloquea /local/:localId/* si no coincide con el local
 * asignado al usuario (admin/worker podían ver cualquier local cambiando la
 * URL a mano). El enforcement real depende de que Backend-V2 valide local_id
 * contra el JWT en cada endpoint — esto no reemplaza eso.
 */
export function LocalIdGuard({ assignedLocalId, children }) {
  const { localId } = useParams()
  if (String(localId) !== String(assignedLocalId)) {
    return <Navigate to="/" replace />
  }
  return children
}

/** Rutas compartidas de local (inventario, POS, admin, dashboard) */
/** Devuelve los <Route> de local (React Router exige <Route> como hijos directos: no es un componente). */
/** `guarded`: true para roles limitados a un solo local (admin) — owner ve todos, no se pasa. */
function localRoutes(assignedLocalId, guarded = false) {
  const wrap = (element) =>
    guarded ? <LocalIdGuard assignedLocalId={assignedLocalId}>{element}</LocalIdGuard> : element

  return (
    <>
      <Route path="/local/:localId/inventario/stock" element={wrap(<MenuBuilderPage />)} />
      <Route path="/local/:localId/inventario/stock-control" element={wrap(<StockControlDashboard />)} />
      <Route path="/local/:localId/inventario/recipes" element={wrap(<RecipesPage />)} />
      <Route path="/local/:localId/inventario/compras-semanales/:orderId" element={wrap(<WeeklyPurchaseDetailPage />)} />
      <Route path="/local/:localId/inventario/compras-semanales" element={wrap(<WeeklyPurchasesPage />)} />
      <Route path="/local/:localId/inventario/proveedores/compras-semanales/:orderId" element={wrap(<LegacyComprasDetailRedirect />)} />
      <Route path="/local/:localId/inventario/proveedores/compras-semanales" element={wrap(<LegacyComprasRedirect />)} />
      <Route path="/local/:localId/inventario/proveedores" element={wrap(<SuppliersKpisDashboard />)} />
      <Route path="/local/:localId/inventario" element={wrap(<InventoryHub />)} />
      <Route path="/local/:localId/administrativo/:sectionId?" element={wrap(<AdministrativeModule />)} />
      <Route path="/local/:localId/rrhh" element={wrap(<HrModule />)} />
      <Route path="/local/:localId/pos" element={wrap(<RestaurantPosOrRedirect />)} />
      <Route path="/local/:localId/pos/cocina" element={wrap(<POSModule />)} />
      <Route path="/local/:localId/pos/reportes" element={wrap(<ReportesPage />)} />
      <Route path="/local/:localId/pos/mesa/:mesaId" element={wrap(<MesaDetail />)} />
      <Route path="/local/:localId/pos/venta-directa" element={wrap(<VentaDirectaView />)} />
      <Route path="/local/:localId/dashboard" element={wrap(<LocalDashboard />)} />
      <Route path="/local/:localId" element={wrap(<LocalModulesHomeRedirect />)} />
    </>
  )
}

/** SUPERADMIN: solo plataforma (gestor) — sin locales operativos */
function SuperadminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/gestor" replace />} />
        <Route path="/gestor" element={<TenantManagerPage />} />
        <Route path="/gestor/resumen" element={<TenantManagerDashboardPage />} />
        <Route path="/gestor/negocios/:businessId" element={<TenantDetailPage />} />
        <Route path="/gestor/auditoria" element={<GlobalAuditPage />} />
        <Route path="/gestor/usuarios" element={<AdminUsersPage />} />
        <Route path="/gestor/observabilidad" element={<ObservabilityPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="*" element={<Navigate to="/gestor" replace />} />
      </Route>
    </Routes>
  )
}

/** ADMIN_NEGOCIO (dueño de franquicia): Tus Locales + Usuarios + todos sus locales */
function OwnerRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/usuarios" element={<UsersListPage />} />
        <Route path="/usuarios/crear" element={<UserManagementPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        {localRoutes()}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}

/** ADMIN: acceso solo a SU local — sin Tus Locales, sin Usuarios */
function AdminRoutes({ assignedLocalId }) {
  // Si tiene local asignado, home es ese local; si no, muestra selector vacío
  const home = assignedLocalId
    ? `/local/${assignedLocalId}/dashboard`
    : '/admin'

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to={home} replace />} />
        {/* /admin redirige siempre a su local */}
        <Route path="/admin" element={<Navigate to={home} replace />} />
        {/* Bloquea /usuarios */}
        <Route path="/usuarios" element={<Navigate to={home} replace />} />
        <Route path="/usuarios/crear" element={<Navigate to={home} replace />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        {localRoutes(assignedLocalId, true)}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

/** TRABAJADOR: solo POS de su local asignado */
function WorkerPosHomeRedirect({ assignedLocalId }) {
  const alPaso = useLocalIsAlPaso(assignedLocalId)
  const home = assignedLocalId
    ? `/local/${assignedLocalId}/pos${alPaso ? '/venta-directa' : ''}`
    : '/'
  return <Navigate to={home} replace />
}

function WorkerRoutes({ assignedLocalId }) {
  const wrap = (element) => <LocalIdGuard assignedLocalId={assignedLocalId}>{element}</LocalIdGuard>

  if (assignedLocalId) {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<WorkerPosHomeRedirect assignedLocalId={assignedLocalId} />} />
          <Route path="/local/:localId/pos" element={wrap(<RestaurantPosOrRedirect />)} />
          <Route path="/local/:localId/pos/cocina" element={wrap(<POSModule />)} />
          <Route path="/local/:localId/pos/mesa/:mesaId" element={wrap(<MesaDetail />)} />
          <Route path="/local/:localId/pos/venta-directa" element={wrap(<VentaDirectaView />)} />
          <Route path="/local/:localId/administrativo/:sectionId?" element={wrap(<AdministrativeModule />)} />
          <Route path="/local/:localId/rrhh" element={wrap(<HrModule />)} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
          <Route path="*" element={<WorkerPosHomeRedirect assignedLocalId={assignedLocalId} />} />
        </Route>
      </Routes>
    )
  }

  // Sin local asignado: selector de local (fallback) — sin assignedLocalId, LocalIdGuard
  // bloquea cualquier /local/:localId (no hay local válido contra el cual comparar).
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/local/:localId/pos" element={wrap(<RestaurantPosOrRedirect />)} />
        <Route path="/local/:localId/pos/cocina" element={wrap(<POSModule />)} />
        <Route path="/local/:localId/pos/mesa/:mesaId" element={wrap(<MesaDetail />)} />
        <Route path="/local/:localId/pos/venta-directa" element={wrap(<VentaDirectaView />)} />
        <Route path="/local/:localId/administrativo/:sectionId?" element={wrap(<AdministrativeModule />)} />
        <Route path="/local/:localId/rrhh" element={wrap(<HrModule />)} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function AuthenticatedApp() {
  const { userRole, assignedLocalId } = useAuth()

  let routes
  if (isSuperAdminRole(userRole)) {
    routes = <SuperadminRoutes />
  } else if (isAdminNegocioRole(userRole)) {
    routes = <OwnerRoutes />
  } else if (WORKER_ROLES.includes(userRole)) {
    routes = <WorkerRoutes assignedLocalId={assignedLocalId} />
  } else {
    routes = <AdminRoutes assignedLocalId={assignedLocalId} />
  }

  return (
    <ErrorBoundary>
      <Router>
        <OnboardingProvider>
          {/* Suspense muestra el fallback mientras se descarga el chunk de la ruta. */}
          <Suspense fallback={<LoadingPage />}>
            {routes}
          </Suspense>
        </OnboardingProvider>
      </Router>
    </ErrorBoundary>
  )
}
