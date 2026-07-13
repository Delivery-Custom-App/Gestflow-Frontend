import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import { useAuth } from '../context/AuthContext'
import CreateLocalDrawer from './CreateLocalDrawer'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'

function getDateRange() {
  const now    = new Date()
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return { dateFrom: h24ago.toISOString(), dateTo: now.toISOString() }
}

function AdminDashboard() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { userRole } = useAuth()
  const isSuperAdmin = userRole?.toUpperCase() === 'SUPERADMIN'

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [salesCounts, setSalesCounts]   = useState({})
  const [deltaCounts, setDeltaCounts]   = useState({})
  const { locales, loading, error, refetch } = useLocals()

  const fetchSalesCounts = useCallback(async (locals) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const { dateFrom, dateTo } = getDateRange()
      const from = new Date(dateFrom)
      const to   = new Date(dateTo)
      const results = await Promise.all(
        locals.map((l) =>
          apiRequest(
            `/orders?local_id=${l.id}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
            { token }
          )
            .then((orders) => {
              if (!Array.isArray(orders)) return { id: l.id, count: 0 }
              const count = orders.filter((o) => {
                const d = new Date(o.created_at)
                return d >= from && d <= to
              }).length
              return { id: l.id, count }
            })
            .catch(() => ({ id: l.id, count: 0 }))
        )
      )
      const counts = {}
      results.forEach(({ id, count }) => { counts[id] = count })
      setSalesCounts(counts)
    } catch {
      // silently ignore — indicators simply won't show
    }
  }, [])

  const fetchDeltaCounts = useCallback(async (locals) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const now   = new Date()
      const h1ago = new Date(now.getTime() - 60  * 60 * 1000)
      const h2ago = new Date(now.getTime() - 120 * 60 * 1000)
      const results = await Promise.all(
        locals.map((l) =>
          apiRequest(
            `/orders?local_id=${l.id}&date_from=${encodeURIComponent(h2ago.toISOString())}&date_to=${encodeURIComponent(now.toISOString())}`,
            { token }
          )
            .then((orders) => {
              if (!Array.isArray(orders)) return { id: l.id, current: 0, prev: 0 }
              const current = orders.filter((o) => new Date(o.created_at) >= h1ago).length
              const prev    = orders.filter((o) => new Date(o.created_at) <  h1ago).length
              return { id: l.id, current, prev }
            })
            .catch(() => ({ id: l.id, current: 0, prev: 0 }))
        )
      )
      const deltas = {}
      results.forEach(({ id, current, prev }) => { deltas[id] = { current, prev, delta: current - prev } })
      setDeltaCounts(deltas)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    if (!loading && locales.length) {
      fetchSalesCounts(locales)
      fetchDeltaCounts(locales)
    }
  }, [loading, locales, fetchSalesCounts, fetchDeltaCounts])

  useEffect(() => {
    if (loading) return
    const st  = location.state
    const fid = st?.focusLocalId
    const loc = st?.local
    if (!fid && !loc?.id) return
    if (!locales?.length) return

    let idx = -1
    if (loc?.id) {
      idx = locales.findIndex((l) => String(l.id) === String(loc.id))
    } else if (fid) {
      idx = locales.findIndex((l) => String(l.id) === String(fid))
    }

    const path = location.pathname === '/' ? '/admin' : location.pathname
    if (idx >= 0) {
      const local = locales[idx]
      navigate(`/local/${local.id}/dashboard`, { state: { local }, replace: true })
      return
    }
    navigate(path, { replace: true, state: {} })
  }, [loading, locales, location.state, location.pathname, navigate])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Cargando franquicias..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          Error: {error}
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    refetch()
    fetchSalesCounts(locales)
    fetchDeltaCounts(locales)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar">
          <LocalsGrid
            locales={locales}
            onLocalSelect={(local) => navigate(`/local/${local.id}/dashboard`, { state: { local } })}
            onCreateLocal={() => setIsDrawerOpen(true)}
            salesCounts={salesCounts}
            deltaCounts={deltaCounts}
            isSuperAdmin={isSuperAdmin}
            onRefresh={handleRefresh}
          />
      </div>
      <CreateLocalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleRefresh}
      />
    </>
  )
}

export default AdminDashboard
