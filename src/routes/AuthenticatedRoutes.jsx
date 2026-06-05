import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ErrorBoundary from '../components/ErrorBoundary'
import AdminDashboard from '../components/AdminDashboard'
import LocalDashboard from '../components/LocalDashboard'
import AdministrativeModule from '../components/AdministrativeModule'
import InventoryHub from '../components/inventory/InventoryHub'
import StockControlDashboard from '../components/inventory/StockControlDashboard'
import SuppliersKpisDashboard from '../components/inventory/SuppliersKpisDashboard'
import WeeklyPurchasesPage from '../components/inventory/weeklyPurchases/WeeklyPurchasesPage'
import WeeklyPurchaseDetailPage from '../components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage'
import RecipesPage from '../components/inventory/recipes/RecipesPage'
import POSModule from '../components/pos/POSModule'
import MesaDetail from '../components/pos/MesaDetail'
import ReportesPage from '../components/pos/ReportesPage'
import UserManagementPage from '../components/UserManagementPage'
import UsersListPage from '../components/UsersListPage'
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
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/local/:localId/pos" element={<POSModule />} />
        <Route path="/local/:localId/pos/cocina" element={<POSModule />} />
        <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    )
  }

  // Sin local asignado: selector de local (fallback)
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/local/:localId/pos" element={<POSModule />} />
      <Route path="/local/:localId/pos/cocina" element={<POSModule />} />
      <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
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
          {routes}
        </OnboardingProvider>
      </Router>
    </ErrorBoundary>
  )
}
