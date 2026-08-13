import { createContext, useContext, useEffect, useState } from 'react'

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

  const [palette, setPalette] = useState(() => {
    try {
      return window.localStorage.getItem('palette') || 'rutek'
    } catch {
      return 'rutek'
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
    } catch {}
  }, [darkMode])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-palette', palette)
    try {
      window.localStorage.setItem('palette', palette)
    } catch {}
  }, [palette])

  const toggleDarkMode = () => setDarkMode((v) => !v)

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, toggleDarkMode, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
