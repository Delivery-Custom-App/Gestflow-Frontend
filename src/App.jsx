import { useState } from 'react'
import LoadingPage from './components/LoadingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import AuthenticatedApp from './routes/AuthenticatedRoutes'
import { AppAuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function AppContent() {
  const { appLoading, user } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

  if (appLoading) {
    return <LoadingPage />
  }

  if (!user) {
    if (showRegister) {
      return <RegisterPage onShowLogin={() => setShowRegister(false)} />
    }
    return <LoginPage onShowRegister={() => setShowRegister(true)} />
  }

  return <AuthenticatedApp />
}

function App() {
  return (
    <ThemeProvider>
      <AppAuthProvider>
        <AppContent />
      </AppAuthProvider>
    </ThemeProvider>
  )
}

export default App
