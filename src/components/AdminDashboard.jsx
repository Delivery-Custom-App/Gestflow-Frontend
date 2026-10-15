import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useLocals } from '../hooks/useLocals'
import { useAuth } from '../context/AuthContext'
import { isAdminNegocioRole, isSuperAdminRole } from '../auth/roleLabel'
import CreateLocalDrawer from './CreateLocalDrawer'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'
import {
  REFRESCO_FLUJO_MS, UMBRAL_POR_DEFECTO, guardarUmbralEnNegocio, leerUmbralDelNegocio, olvidarUmbralLocal,
  rangoDelPeriodo, umbralLocalParaSubir,
} from '../lib/umbralFlujo'

const ESTADOS_NO_CANCELADOS = ['open', 'preparing', 'ready', 'completed']

const contarOrdenesEntre = (localId, desde, hasta, token) => {
  const query = new URLSearchParams({
    local_id: String(localId),
    date_from: desde.toISOString(),
    date_to: hasta.toISOString(),
    limit: '1',
    offset: '0',
  })
  ESTADOS_NO_CANCELADOS.forEach((status) => query.append('status', status))
  return apiRequest(`/orders?${query.toString()}`, { token, withTotal: true })
}

function totalOrdenes(respuesta) {
  return Number.isFinite(respuesta?.total) ? respuesta.total : 0
}

function AdminDashboard() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { userRole } = useAuth()
  // El dueño ya no elimina franquicias desde Inicio: queda reservado al
  // superadmin (soporte de la empresa). El código de borrado se conserva.
  const puedeEliminarLocales = isSuperAdminRole(userRole)
  // /usuarios solo está montado en las rutas del dueño.
  const esDueno = isAdminNegocioRole(userRole)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [salesCounts, setSalesCounts]   = useState({})
  const [deltaCounts, setDeltaCounts]   = useState({})
  // Umbral de flujo: uno solo para todo el negocio, guardado en el backend (T-59).
  const [umbral, setUmbral]             = useState(UMBRAL_POR_DEFECTO)
  const [businessId, setBusinessId]     = useState(null)
  const [umbralParaSubir, setUmbralParaSubir] = useState(null)
  const puedeEditarUmbral = esDueno || isSuperAdminRole(userRole)
  const { locales, loading, error, refetch } = useLocals()

  /** Ventas (órdenes no canceladas) de cada local en el período del umbral. */
  const fetchSalesCounts = useCallback(async (locals, horas) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const { desde, hasta } = rangoDelPeriodo(horas)
      const results = await Promise.all(
        locals.map((l) =>
          contarOrdenesEntre(l.id, desde, hasta, token)
            .then((respuesta) => ({ id: l.id, count: totalOrdenes(respuesta) }))
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

  /** Para la flecha: ventas de la última hora y de la hora anterior. */
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
          Promise.all([
            contarOrdenesEntre(l.id, h1ago, now, token),
            contarOrdenesEntre(l.id, h2ago, h1ago, token),
          ])
            .then(([current, prev]) => ({ id: l.id, current: totalOrdenes(current), prev: totalOrdenes(prev) }))
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

  // Cuenta al entrar, al cambiar el período, cada minuto y al volver a la pestaña.
  useEffect(() => {
    if (loading || !locales.length) return undefined
    const contar = () => {
      fetchSalesCounts(locales, umbral.horas)
      fetchDeltaCounts(locales)
    }
    contar()
    const intervalo = setInterval(contar, REFRESCO_FLUJO_MS)
    window.addEventListener('focus', contar)
    return () => { clearInterval(intervalo); window.removeEventListener('focus', contar) }
  }, [loading, locales, umbral.horas, fetchSalesCounts, fetchDeltaCounts])

  useEffect(() => {
    let ignore = false
    getOptionalAuthContext()
      .then(({ businessId: id }) => {
        if (!id) return null
        setBusinessId(id)
        return leerUmbralDelNegocio(id)
      })
      .then((delNegocio) => {
        if (ignore || !delNegocio) return
        setUmbral(delNegocio)
        if (puedeEditarUmbral) setUmbralParaSubir(umbralLocalParaSubir(delNegocio))
      })
      .catch(() => { /* sin ajustes: se usan los valores por defecto */ })
    return () => { ignore = true }
  }, [puedeEditarUmbral])

  const handleGuardarUmbral = useCallback(async (nuevo) => {
    setUmbral(await guardarUmbralEnNegocio(businessId, nuevo))
  }, [businessId])

  const subirUmbralLocal = useCallback(async () => {
    try {
      setUmbral(await guardarUmbralEnNegocio(businessId, umbralParaSubir))
    } finally {
      olvidarUmbralLocal()
      setUmbralParaSubir(null)
    }
  }, [businessId, umbralParaSubir])

  const descartarUmbralLocal = useCallback(() => {
    olvidarUmbralLocal()
    setUmbralParaSubir(null)
  }, [])

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
    fetchSalesCounts(locales, umbral.horas)
    fetchDeltaCounts(locales)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar">
          {umbralParaSubir && (
            <div role="note" aria-label="Umbral de este navegador" className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6">
              <span className="flex-1">
                En este navegador tenías un umbral de flujo propio (medio desde {umbralParaSubir.medium}, alto desde {umbralParaSubir.high}, en {umbralParaSubir.horas} h). Ahora es uno solo para todo el negocio: ¿lo guardas para todos?
              </span>
              <button type="button" onClick={subirUmbralLocal} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Guardar para el negocio</button>
              <button type="button" onClick={descartarUmbralLocal} className="rounded-lg px-3 py-1.5 text-xs font-semibold">No, descartar</button>
            </div>
          )}
          <LocalsGrid
            locales={locales}
            onLocalSelect={(local) => navigate(`/local/${local.id}/dashboard`, { state: { local } })}
            onCreateLocal={() => setIsDrawerOpen(true)}
            onShowUsers={esDueno ? () => navigate('/usuarios') : undefined}
            salesCounts={salesCounts}
            deltaCounts={deltaCounts}
            umbral={umbral}
            onGuardarUmbral={puedeEditarUmbral && businessId ? handleGuardarUmbral : undefined}
            canDeleteLocals={puedeEliminarLocales}
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
