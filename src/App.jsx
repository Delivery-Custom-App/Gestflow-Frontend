import { AnimatePresence } from 'framer-motion'
import LoadingPage from './components/LoadingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import AuthenticatedApp from './routes/AuthenticatedRoutes'
import NetworkErrorModal from './components/NetworkErrorModal'
import MercadoPagoReturn from './components/MercadoPagoReturn'
import { AppAuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function AppContent() {
  const { appLoading, user } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

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
        <MercadoPagoReturn />
      </AppAuthProvider>
    </ThemeProvider>
  )
}

export default App
