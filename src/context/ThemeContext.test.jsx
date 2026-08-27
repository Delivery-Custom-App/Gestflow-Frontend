import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

function Probe() {
  const { palette, setPalette, darkMode, toggleDarkMode } = useTheme()
  return (
    <div>
      <span data-testid="palette">{palette}</span>
      <span data-testid="dark">{String(darkMode)}</span>
      <button onClick={() => setPalette('legacy')}>legacy-btn</button>
      <button onClick={() => setPalette('rutek')}>rutek-btn</button>
      <button onClick={toggleDarkMode}>dark-btn</button>
    </div>
  )
}

describe('ThemeContext palette switching', () => {
  beforeEach(() => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
    document.documentElement.removeAttribute('data-palette')
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to rutek light and applies data-palette attr', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('palette').textContent).toBe('rutek')
    expect(screen.getByTestId('dark').textContent).toBe('false')
    expect(document.documentElement.getAttribute('data-palette')).toBe('rutek')
  })

  it('switches to legacy and back, persisting and applying attr', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    fireEvent.click(screen.getByText('legacy-btn'))
    expect(screen.getByTestId('palette').textContent).toBe('legacy')
    expect(document.documentElement.getAttribute('data-palette')).toBe('legacy')
    expect(window.localStorage.getItem('palette')).toBe('legacy')

    fireEvent.click(screen.getByText('rutek-btn'))
    expect(screen.getByTestId('palette').textContent).toBe('rutek')
    expect(document.documentElement.getAttribute('data-palette')).toBe('rutek')
    expect(window.localStorage.getItem('palette')).toBe('rutek')
  })

  it('rehydrates stored legacy palette on mount', () => {
    window.localStorage.setItem('palette', 'legacy')
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('palette').textContent).toBe('legacy')
    expect(document.documentElement.getAttribute('data-palette')).toBe('legacy')
  })

  it('dark toggle still works alongside palette', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    fireEvent.click(screen.getByText('dark-btn'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByTestId('dark').textContent).toBe('true')
  })
})
