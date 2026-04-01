import { useState, useEffect, useCallback, memo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import AdminDashboard from './components/AdminDashboard'
import ClientDashboard from './components/ClientDashboard'
import Cart from './components/Cart'
import LoginPage from './components/LoginPage'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import { getRoleFromToken } from './utils/jwt'

// Componente HomeRoute memoizado para evitar re-renders innecesarios
const HomeRoute = memo(({ user, userRole, showPassword, setShowPassword, email, setEmail, password, setPassword, isLoading, errorMessage, successMessage, handleSubmit, handleLogout }) => {
  if (!user) {
    return (
      <LoginPage
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
        handleSubmit={handleSubmit}
      />
    )
  }

  // Determinar qué dashboard mostrar según el rol
  if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
    return <AdminDashboard user={user} onLogout={handleLogout} />
  }

  // Por defecto, usuarios CLIENTE
  return <ClientDashboard user={user} onLogout={handleLogout} />
})

function App() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    // Verificar sesión existente
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) return

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setUser(data.session.user)
        // Extraer rol del token
        const role = getRoleFromToken(data.session.access_token)
        setUserRole(role || 'CLIENTE') // Por defecto CLIENTE si no hay rol
        console.log('Rol detectado en sesión:', role)
      }
    }

    checkSession()
  }, [])

  const handleSubmit = useCallback(async (event) => {
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMessage(error.message)
      setIsLoading(false)
      return
    }

    const userEmail = data.user?.email ?? email
    setUser(data.user)
    
    // Extraer rol del token del nuevo login
    const role = getRoleFromToken(data.session.access_token)
    setUserRole(role || 'CLIENTE')
    console.log('Rol detectado en login:', role)
    
    setSuccessMessage(`Sesion iniciada como ${userEmail}.`)
    setIsLoading(false)
  }, [email, password])

  const handleLogout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut()
      setUser(null)
      setUserRole(null)
      setEmail('')
      setPassword('')
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública del carrito - accesible sin login */}
        <Route path="/cart" element={<Cart />} />

        {/* Ruta del dashboard/login - requiere login para acceder al dashboard */}
        <Route
          path="/"
          element={
            <HomeRoute
              user={user}
              userRole={userRole}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              isLoading={isLoading}
              errorMessage={errorMessage}
              successMessage={successMessage}
              handleSubmit={handleSubmit}
              handleLogout={handleLogout}
            />
          }
        />

        {/* Redirigir cualquier otra ruta a home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
