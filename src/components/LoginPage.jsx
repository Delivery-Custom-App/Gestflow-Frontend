import { useCallback, memo } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

/**
 * Página de login
 */
function LoginPage({
  showPassword,
  setShowPassword,
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  errorMessage,
  successMessage,
  handleSubmit,
}) {
  // Crear handlers memoizados para los inputs
  const handleEmailChange = useCallback((event) => {
    setEmail(event.target.value)
  }, [setEmail])

  const handlePasswordChange = useCallback((event) => {
    setPassword(event.target.value)
  }, [setPassword])

  const handleTogglePassword = useCallback(() => {
    setShowPassword((value) => !value)
  }, [setShowPassword])
  return (
    <main className="login-page">
      <header className="brand-header" aria-label="Marca">
        <div className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" role="presentation">
            <rect
              x="5"
              y="3"
              width="10"
              height="18"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="9"
              y="7"
              width="10"
              height="14"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <line
              x1="9"
              y1="11"
              x2="13"
              y2="11"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <line
              x1="9"
              y1="14"
              x2="13"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </div>
        <h1>SibaGestion</h1>
        <p className="subtitle">Sistema de Gestion Comercial</p>
        <p className="tagline">Sibaritico desde 1991</p>
      </header>

      <section className="login-card" aria-label="Formulario de inicio de sesion">
        <h2>Iniciar Sesion</h2>

        <p className="demo-status">
          {isSupabaseConfigured
            ? 'Autenticacion Supabase activada'
            : 'Modo demostracion activado'}
        </p>

        <aside className="demo-box">
          <p className="demo-title">Estado:</p>
          <p>
            {isSupabaseConfigured
              ? 'Tu proyecto esta conectado a Supabase. Puedes iniciar sesion con usuarios reales.'
              : 'Aun no hay variables de entorno de Supabase. Configuralas para usar autenticacion real.'}
          </p>
        </aside>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Correo Electronico</label>
          <input
            id="email"
            type="email"
            placeholder="usuario@empresa.com"
            autoComplete="off"
            value={email}
            onChange={handleEmailChange}
            disabled={isLoading}
          />

          <label htmlFor="password">Contrasena</label>
          <div className="password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Tu contrasena"
              autoComplete="off"
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={handleTogglePassword}
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              disabled={isLoading}
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  role="presentation"
                >
                  <path
                    d="M3 3L21 21"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
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
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  role="presentation"
                >
                  <path
                    d="M3 12C4.22 8.06 7.6 4.8 12 4.8C16.4 4.8 19.78 8.06 21 12C19.78 15.94 16.4 19.2 12 19.2C7.6 19.2 4.22 15.94 3 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            <span aria-hidden="true" className="button-icon">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <rect
                  x="5"
                  y="3"
                  width="10"
                  height="18"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <rect
                  x="9"
                  y="7"
                  width="10"
                  height="14"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            {isLoading ? 'Validando...' : 'Entrar'}
          </button>

          {errorMessage && (
            <p className="auth-message auth-error">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="auth-message auth-success">{successMessage}</p>
          )}
        </form>

        <nav className="bottom-nav" aria-label="Acciones">
          <button type="button" aria-label="Tendencias">
            <svg viewBox="0 0 24 24" fill="none" role="presentation">
              <path
                d="M4 16L9 11L13 14L20 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 7H20V12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" aria-label="Inventario">
            <svg viewBox="0 0 24 24" fill="none" role="presentation">
              <rect
                x="5"
                y="3"
                width="10"
                height="18"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="9"
                y="7"
                width="10"
                height="14"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </button>
          <button type="button" aria-label="Usuarios">
            <svg viewBox="0 0 24 24" fill="none" role="presentation">
              <circle
                cx="9"
                cy="9"
                r="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="17"
                cy="10"
                r="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M3.5 19C4.1 16.6 6.3 15 9 15C11.7 15 13.9 16.6 14.5 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M14.5 18.5C14.9 17 16.3 16 18 16C19.7 16 21.1 17 21.5 18.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </nav>
      </section>
    </main>
  )
}

export default memo(LoginPage)
