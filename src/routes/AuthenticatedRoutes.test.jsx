import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { LocalIdGuard } from './AuthenticatedRoutes'

function Protected() {
  return <div>secret-local-content</div>
}

function Home() {
  return <div>home</div>
}

function renderAt(path, assignedLocalId) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/local/:localId"
          element={
            <LocalIdGuard assignedLocalId={assignedLocalId}>
              <Protected />
            </LocalIdGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('LocalIdGuard', () => {
  it('renders children when :localId matches assignedLocalId', () => {
    renderAt('/local/42', 42)
    expect(screen.getByText('secret-local-content')).toBeInTheDocument()
  })

  it('redirects home when :localId does not match assignedLocalId (URL editada a mano)', () => {
    renderAt('/local/99', 42)
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('secret-local-content')).not.toBeInTheDocument()
  })

  it('redirects home when assignedLocalId is undefined (sin local asignado)', () => {
    renderAt('/local/42', undefined)
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('matches regardless of string/number type differences', () => {
    renderAt('/local/42', '42')
    expect(screen.getByText('secret-local-content')).toBeInTheDocument()
  })
})
