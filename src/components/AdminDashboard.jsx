import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import { useAuth } from '../context/AuthContext'
import CreateLocalDrawer from './CreateLocalDrawer'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'

function getDateRange() {
  let salesDays = 1
  try {
    const stored = localStorage.getItem('sibagestion_flow_thresholds')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed.salesDays === 'number' && parsed.salesDays >= 1) salesDays = parsed.salesDays
    }
  } catch { /* use default */ }

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setDate(start.getDate() - (salesDays - 1))
  start.setHours(0, 0, 0, 0)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}

function AdminDashboard() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { userRole } = useAuth()
  const isSuperAdmin = userRole?.toUpperCase() === 'SUPERADMIN'

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [salesCounts, setSalesCounts]   = useState({})
  const { locales, loading, error, refetch } = useLocals()

  const fetchSalesCounts = useCallback(async (locals) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const { dateFrom, dateTo } = getDateRange()
      const results = await Promise.all(
        locals.map((l) =>
          apiRequest(
            `/orders?local_id=${l.id}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
            { token }
          )
            .then((orders) => ({ id: l.id, count: Array.isArray(orders) ? orders.length : 0 }))
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

  useEffect(() => {
    if (!loading && locales.length) fetchSalesCounts(locales)
  }, [loading, locales, fetchSalesCounts])

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
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar">
          <LocalsGrid
            locales={locales}
            onLocalSelect={(local) => navigate(`/local/${local.id}/dashboard`, { state: { local } })}
            onCreateLocal={() => setIsDrawerOpen(true)}
            salesCounts={salesCounts}
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
