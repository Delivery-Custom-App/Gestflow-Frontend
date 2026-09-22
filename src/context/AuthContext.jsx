import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearStoredSession, fetchCurrentUser, getStoredSession, loginWithPassword, logoutSession, refreshSession } from '../lib/authClient'
import { getUserRole } from '../utils/jwt'
import { WORKER_ROLES } from '../constants/roles'
import { formatRoleLabel } from '../auth/roleLabel'
import { isInventoryAdminRole } from '../utils/inventoryAccess'

const AuthContext = createContext(null)

function getAssignedLocalId(user) {
  return user?.local_id || user?.app_metadata?.local_id || user?.user_metadata?.local_id || null
}

/**
 * Proveedor raíz de auth: sesión inicial, login, logout y contexto para la app.
 */
export function AppAuthProvider({ children }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const clearAuthState = useCallback(() => {
    setUser(null)
    setUserRole(null)
  }, [])

  const clearPreviousSession = useCallback(async () => {
    clearStoredSession()
    clearAuthState()
  }, [clearAuthState])

  /** Vuelve a pedir /auth/me y actualiza `user` en contexto (ej. tras cambiar avatar). */
  const refreshUser = useCallback(async () => {
    const session = getStoredSession()
    if (!session?.access_token) return null
    const sessionUser = await fetchCurrentUser(session.access_token)
    if (sessionUser) setUser(sessionUser)
    return sessionUser
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      const session = getStoredSession()
      if (!session?.access_token) {
        return
      }

      try {
        const refreshedSession = await refreshSession()
        const activeSession = refreshedSession || session
        const accessToken = activeSession.access_token

        if (!accessToken) {
          await clearPreviousSession()
          return
        }

        const sessionUser = await fetchCurrentUser(accessToken)
        if (!sessionUser) {
          await clearPreviousSession()
          return
        }

        const roleFromDb = getUserRole(sessionUser, accessToken)

        setUser(sessionUser)
        setUserRole(formatRoleLabel(roleFromDb))
      } catch {
        await clearPreviousSession()
      }
    }

    // El loader se mantiene 600ms extra para evitar un parpadeo al arrancar.
    let cancelled = false
    let loadingTimer
    checkSession().finally(() => {
      if (!cancelled) loadingTimer = setTimeout(() => setAppLoading(false), 600)
    })
    return () => {
      cancelled = true
      clearTimeout(loadingTimer)
    }
  }, [clearPreviousSession])

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAuthState()
      setEmail('')
      setPassword('')
      setErrorMessage('Tu sesion expiro. Ingresa nuevamente.')
      setSuccessMessage('')
    }

    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [clearAuthState])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!email || !password) {
      setErrorMessage('Ingresa correo y contrasena para continuar.')
      return
    }

    setIsLoading(true)

    try {
      const session = await loginWithPassword({
        email,
        password,
      })

      const accessToken = session.access_token
      if (!accessToken) {
        await clearPreviousSession()
        setErrorMessage('No se recibio access_token al iniciar sesion')
        return
      }

      const sessionUser = session.user || await fetchCurrentUser(accessToken)
      if (!sessionUser) {
        await clearPreviousSession()
        setErrorMessage('No se recibio el usuario autenticado')
        return
      }

      const userEmail = sessionUser.email ?? email
      const roleFromDb = getUserRole(sessionUser, accessToken)

      setUser(sessionUser)
      setUserRole(formatRoleLabel(roleFromDb))
      setSuccessMessage(`Sesion iniciada como ${userEmail}.`)

      const loginRedirect = (import.meta.env.VITE_LOGIN_REDIRECT || '').trim()
      if (loginRedirect && typeof window !== 'undefined') {
        const path = loginRedirect.startsWith('/') ? loginRedirect : `/${loginRedirect}`
        window.location.replace(path)
        return
      }
    } catch (error) {
      await clearPreviousSession()
      setErrorMessage(error?.message || 'Error de autenticacion')
    } finally {
      setIsLoading(false)
    }
  }, [email, password, clearPreviousSession])

  const logout = useCallback(async () => {
    await logoutSession()
    setUser(null)
    setUserRole(null)
    setEmail('')
    setPassword('')
    setErrorMessage('')
    setSuccessMessage('')
    // Limpia la URL para que el próximo login arranque desde /
    window.history.replaceState({}, document.title, '/')
  }, [])

  const value = useMemo(() => {
    const role = userRole ?? null
    return {
      user: user ?? null,
      userRole: role,
      assignedLocalId: getAssignedLocalId(user),
      logout,
      refreshUser,
      isWorker: role != null && WORKER_ROLES.includes(role),
      isInventoryAdmin: isInventoryAdminRole(role),
      appLoading,
      login: {
        email,
        setEmail,
        password,
        setPassword,
        isLoading,
        errorMessage,
        successMessage,
        handleSubmit,
      },
    }
  }, [
    user,
    userRole,
    logout,
    refreshUser,
    appLoading,
    email,
    password,
    isLoading,
    errorMessage,
    successMessage,
    handleSubmit,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Patrón estándar de contexto: el hook vive junto a su Provider (se importa en 17 archivos).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AppAuthProvider')
  }
  return ctx
}

/** Tests / montajes aislados: contexto estático sin backend de auth. */
export function AuthProvider({ user, userRole, logout, children }) {
  const value = useMemo(() => {
    const role = userRole ?? null
    return {
      user: user ?? null,
      userRole: role,
      logout,
      isWorker: role != null && WORKER_ROLES.includes(role),
      isInventoryAdmin: isInventoryAdminRole(role),
      appLoading: false,
      login: {
        email: '',
        setEmail: () => {},
        password: '',
        setPassword: () => {},
        isLoading: false,
        errorMessage: '',
        successMessage: '',
        handleSubmit: (event) => event?.preventDefault?.(),
      },
    }
  }, [user, userRole, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
