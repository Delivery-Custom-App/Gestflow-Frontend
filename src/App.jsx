import { AnimatePresence } from 'framer-motion'
import LoadingPage from './components/LoadingPage'
import LoginPage from './components/LoginPage'
import AuthenticatedApp from './routes/AuthenticatedRoutes'
import NetworkErrorModal from './components/NetworkErrorModal'
import { AppAuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function AppContent() {
  const { appLoading, user } = useAuth()

  return (
    <AnimatePresence mode="wait">
      {appLoading ? (
        <LoadingPage key="loading" />
      ) : !user ? (
        <LoginPage key="login" />
      ) : (
        <AuthenticatedApp key="app" />
      )}
    </AnimatePresence>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppAuthProvider>
        <AppContent />
        <NetworkErrorModal />
      </AppAuthProvider>
    </ThemeProvider>
  )
}

export default App
