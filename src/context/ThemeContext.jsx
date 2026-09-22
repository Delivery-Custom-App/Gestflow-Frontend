import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = window.localStorage.getItem('theme')
      return stored === null ? false : stored === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      window.localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    } catch { /* storage no disponible */ }
  }, [darkMode])

  const toggleDarkMode = useCallback(() => setDarkMode((v) => !v), [])
  const value = useMemo(() => ({ darkMode, setDarkMode, toggleDarkMode }), [darkMode, toggleDarkMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Patrón estándar de contexto: el hook vive junto a su Provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
