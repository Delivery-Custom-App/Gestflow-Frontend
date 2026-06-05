import LoadingPage from './components/LoadingPage'
import LoginPage from './components/LoginPage'
import AuthenticatedApp from './routes/AuthenticatedRoutes'
import { AppAuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function AppContent() {
  const { appLoading, user } = useAuth()

  if (appLoading) {
    return <LoadingPage />
  }

  if (!user) {
    return <LoginPage />
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
