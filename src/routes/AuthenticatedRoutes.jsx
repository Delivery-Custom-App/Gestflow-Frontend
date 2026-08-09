import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
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
const SuppliersKpisDashboard = lazy(() => import('../components/inventory/SuppliersKpisDashboard'))
const WeeklyPurchasesPage = lazy(() => import('../components/inventory/weeklyPurchases/WeeklyPurchasesPage'))
const WeeklyPurchaseDetailPage = lazy(() => import('../components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage'))
const RecipesPage = lazy(() => import('../components/inventory/recipes/RecipesPage'))
const POSModule = lazy(() => import('../components/pos/POSModule'))
const MesaDetail = lazy(() => import('../components/pos/MesaDetail'))
const ReportesPage = lazy(() => import('../components/pos/ReportesPage'))
const UserManagementPage = lazy(() => import('../components/UserManagementPage'))
const UsersListPage = lazy(() => import('../components/UsersListPage'))
const TenantManagerPage = lazy(() => import('../components/TenantManagerPage'))
import { OnboardingProvider } from '../context/OnboardingContext'
import { WORKER_ROLES } from '../constants/roles'
import { isSuperAdminRole } from '../auth/roleLabel'
import { useAuth } from '../context/AuthContext'

const ROUTER_FUTURE_FLAGS = { v7_startTransition: true, v7_relativeSplatPath: true }

function AdminLayout() {
  return <AppShell />
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

/** Rutas compartidas de local (inventario, POS, admin, dashboard) */
function LocalRoutes() {
  return (
    <>
      <Route path="/local/:localId/inventario/stock" element={<StockControlDashboard />} />
      <Route path="/local/:localId/inventario/recipes" element={<RecipesPage />} />
      <Route path="/local/:localId/inventario/compras-semanales/:orderId" element={<WeeklyPurchaseDetailPage />} />
      <Route path="/local/:localId/inventario/compras-semanales" element={<WeeklyPurchasesPage />} />
      <Route path="/local/:localId/inventario/proveedores/compras-semanales/:orderId" element={<LegacyComprasDetailRedirect />} />
      <Route path="/local/:localId/inventario/proveedores/compras-semanales" element={<LegacyComprasRedirect />} />
      <Route path="/local/:localId/inventario/proveedores" element={<SuppliersKpisDashboard />} />
      <Route path="/local/:localId/inventario" element={<InventoryHub />} />
      <Route path="/local/:localId/administrativo/:sectionId?" element={<AdministrativeModule />} />
      <Route path="/local/:localId/pos" element={<POSModule />} />
      <Route path="/local/:localId/pos/cocina" element={<POSModule />} />
      <Route path="/local/:localId/pos/reportes" element={<ReportesPage />} />
      <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
      <Route path="/local/:localId/dashboard" element={<LocalDashboard />} />
      <Route path="/local/:localId" element={<LocalModulesHomeRedirect />} />
    </>
  )
}

/** SUPERADMIN: acceso total — Tus Locales, Usuarios, todos los locales */
function SuperadminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/gestor" element={<TenantManagerPage />} />
        <Route path="/usuarios" element={<UsersListPage />} />
        <Route path="/usuarios/crear" element={<UserManagementPage />} />
        {LocalRoutes()}
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
        {LocalRoutes()}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

/** TRABAJADOR: solo POS de su local asignado */
function WorkerRoutes({ assignedLocalId }) {
  const home = assignedLocalId ? `/local/${assignedLocalId}/pos` : '/'

  if (assignedLocalId) {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/local/:localId/pos" element={<POSModule />} />
          <Route path="/local/:localId/pos/cocina" element={<POSModule />} />
          <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Route>
      </Routes>
    )
  }

  // Sin local asignado: selector de local (fallback)
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/local/:localId/pos" element={<POSModule />} />
        <Route path="/local/:localId/pos/cocina" element={<POSModule />} />
        <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
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
  } else if (WORKER_ROLES.includes(userRole)) {
    routes = <WorkerRoutes assignedLocalId={assignedLocalId} />
  } else {
    routes = <AdminRoutes assignedLocalId={assignedLocalId} />
  }

  return (
    <ErrorBoundary>
      <Router future={ROUTER_FUTURE_FLAGS}>
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
