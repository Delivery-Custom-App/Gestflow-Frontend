import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import './App.css'
import AdminDashboard from './components/AdminDashboard'
import OrderSummary from './components/OrderSummary'
import ChangeLocal from './components/ChangeLocal'
import AdministrativeModule from './components/AdministrativeModule'
import InventoryHub from './components/inventory/InventoryHub'
import StockControlDashboard from './components/inventory/StockControlDashboard'
import SuppliersKpisDashboard from './components/inventory/SuppliersKpisDashboard'
import RecipesPage from './components/inventory/recipes/RecipesPage'
import POSModule from './components/pos/POSModule'
import MesaDetail from './components/pos/MesaDetail'
import WorkerLocalSelector from './components/WorkerLocalSelector'
import LoadingPage from './components/LoadingPage'

const WORKER_ROLES = ['Empleado', 'Cajero']
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import { getUserRole } from './utils/jwt'

/** /local/:id ya no es pantalla propia: vuelve a /admin y reabre módulos del local */
function LocalModulesHomeRedirect() {
  const { localId } = useParams()
  const { state } = useLocation()
  const merged =
    typeof state === 'object' && state !== null ? { ...state, focusLocalId: localId } : { focusLocalId: localId }
  return <Navigate to="/admin" replace state={merged} />
}

function formatRoleLabel(role) {
  if (!role) return 'Usuario'
  return role
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Coincide con rol superadmin tras formatRoleLabel ("Superadmin") o valor crudo del JWT. */
function isSuperAdminRole(roleLabel) {
  if (!roleLabel) return false
  const n = String(roleLabel).toLowerCase().replace(/\s+/g, '')
  return n === 'superadmin'
}

function App() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const clearStoredAuthToken = () => {
    if (typeof window === 'undefined') return

    const keys = Object.keys(window.localStorage)
    keys.forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        window.localStorage.removeItem(key)
      }
    })
  }

  const clearAuthState = () => {
    setUser(null)
    setUserRole(null)
  }

  const clearPreviousSession = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Si falla signOut igual forzamos limpieza local para evitar tokens stale.
      }
    }

    clearStoredAuthToken()
    clearAuthState()
  }

  useEffect(() => {
    // Verificar sesión existente
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setTimeout(() => setAppLoading(false), 600)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token

      if (error || !accessToken) {
        clearAuthState()
        setTimeout(() => setAppLoading(false), 600)
        return
      }

      const sessionUser = data.session.user
      const roleFromDb = getUserRole(sessionUser, accessToken)

      setUser(sessionUser)
      setUserRole(formatRoleLabel(roleFromDb))
      setTimeout(() => setAppLoading(false), 600)
    }

    checkSession()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase no esta configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
      return
    }

    if (!email || !password) {
      setErrorMessage('Ingresa correo y contrasena para continuar.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        await clearPreviousSession()
        setErrorMessage(error.message || 'Error de autenticacion')
        return
      }

      const accessToken = data.session?.access_token
      if (!accessToken) {
        await clearPreviousSession()
        setErrorMessage('No se recibio session.access_token al iniciar sesion')
        return
      }

      const sessionUser = data.session?.user || data.user
      if (!sessionUser) {
        await clearPreviousSession()
        setErrorMessage('No se recibio el usuario autenticado en la sesion')
        return
      }

      const userEmail = sessionUser.email ?? email
      const roleFromDb = getUserRole(sessionUser, accessToken)

      setUser(sessionUser)
      setUserRole(formatRoleLabel(roleFromDb))
      setSuccessMessage(`Sesion iniciada como ${userEmail}.`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
      setUser(null)
      setUserRole(null)
      setEmail('')
      setPassword('')
    }
  }

  // Mostrar página de carga mientras se verifica la sesión
  if (appLoading) {
    return <LoadingPage />
  }

  // Superadmin: mismas rutas que admin (la comparación estricta con 'SUPERADMIN' fallaba tras formatRoleLabel → 'Superadmin')
  if (user && isSuperAdminRole(userRole)) {
    return (
      <Router>
        <Routes>
          <Route path="/admin" element={<AdminDashboard user={user} userRole={userRole} onLogout={handleLogout} />} />
          <Route
            path="/local/:localId/inventario/stock"
            element={<StockControlDashboard user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route
            path="/local/:localId/inventario/recipes"
            element={<RecipesPage user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route
            path="/local/:localId/inventario/proveedores"
            element={<SuppliersKpisDashboard user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route
            path="/local/:localId/inventario"
            element={<InventoryHub user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route
            path="/local/:localId/administrativo/:sectionId?"
            element={<AdministrativeModule user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route path="/local/:localId/pos" element={<POSModule user={user} userRole={userRole} onLogout={handleLogout} />} />
          <Route
            path="/local/:localId/pos/mesa/:mesaId"
            element={<MesaDetail user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route path="/local/:localId" element={<LocalModulesHomeRedirect />} />
          {/* Resumen de pedido y cambio de local */}
          <Route path="/order/:orderId/summary" element={<OrderSummary />} />
          <Route path="/order/:orderId/change-local" element={<ChangeLocal />} />
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Router>
    )
  }

  // Roles de trabajador: solo acceso al POS
  if (user && WORKER_ROLES.includes(userRole)) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<WorkerLocalSelector user={user} userRole={userRole} onLogout={handleLogout} />} />
          <Route
            path="/local/:localId/pos"
            element={<POSModule user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route
            path="/local/:localId/pos/mesa/:mesaId"
            element={<MesaDetail user={user} userRole={userRole} onLogout={handleLogout} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    )
  }

  if (!user) {
    return (
      <main className="login-page">

        <section className="login-card" aria-label="Formulario de inicio de sesion">
          <h2>Iniciar Sesion</h2>

          {/* Status block removed as requested */}

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Correo Electronico</label>
            <input
              id="email"
              type="email"
              placeholder="usuario@empresa.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
            />

            <label htmlFor="password">Contrasena</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contrasena"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" role="presentation">
                    <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path
                      d="M10.58 10.58C10.21 10.95 10 11.45 10 12C10 13.1 10.9 14 12 14C12.55 14 13.05 13.79 13.42 13.42"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.88 5.1C10.56 4.9 11.27 4.8 12 4.8C16.4 4.8 19.78 8.06 21 12C20.6 13.3 19.93 14.48 19.05 15.47"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14.12 18.9C13.44 19.1 12.73 19.2 12 19.2C7.6 19.2 4.22 15.94 3 12C3.4 10.7 4.07 9.52 4.95 8.53"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" role="presentation">
                    <path
                      d="M3 12C4.22 8.06 7.6 4.8 12 4.8C16.4 4.8 19.78 8.06 21 12C19.78 15.94 16.4 19.2 12 19.2C7.6 19.2 4.22 15.94 3 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" className="login-button" disabled={isLoading || !email || !password}>
              <span aria-hidden="true" className="button-icon">
                <svg viewBox="0 0 24 24" fill="none" role="presentation">
                  <rect x="5" y="3" width="10" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="9" y="7" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
              {isLoading ? 'Validando...' : 'Entrar'}
            </button>

            {errorMessage && <p className="auth-message auth-error">{errorMessage}</p>}
            {successMessage && <p className="auth-message auth-success">{successMessage}</p>}
          </form>
          {/* Bottom nav buttons removed as requested */}
        </section>
      </main>
    )
  }

  // Si el usuario está logueado, mostrar las rutas
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminDashboard user={user} userRole={userRole} onLogout={handleLogout} />} />
        <Route path="/admin" element={<AdminDashboard user={user} userRole={userRole} onLogout={handleLogout} />} />
        {/* Specific inventory subroutes (must come before /local/:localId catch-all) */}
        <Route
          path="/local/:localId/inventario/stock"
          element={<StockControlDashboard user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        <Route
          path="/local/:localId/inventario/recipes"
          element={<RecipesPage user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        <Route
          path="/local/:localId/inventario/proveedores"
          element={<SuppliersKpisDashboard user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        <Route
          path="/local/:localId/inventario"
          element={<InventoryHub user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        <Route
          path="/local/:localId/administrativo/:sectionId?"
          element={<AdministrativeModule user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        <Route
          path="/local/:localId/pos"
          element={<POSModule user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        {/* Detalle de mesa en POS */}
        <Route
          path="/local/:localId/pos/mesa/:mesaId"
          element={<MesaDetail user={user} userRole={userRole} onLogout={handleLogout} />}
        />
        {/* Catch-all for /local/:localId (must come after all specific subroutes) */}
        <Route path="/local/:localId" element={<LocalModulesHomeRedirect />} />
        {/* Global catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
