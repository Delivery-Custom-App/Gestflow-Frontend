/**
 * Hook de alertas administrativas con SSE + fallback a polling.
 * Expone el listado, conteo de pendientes, y acciones de resolución y evaluación.
 *
 * Estrategia de live updates:
 *   1. Abre EventSource con token en query param (EventSource no soporta headers).
 *   2. Si SSE falla o no está disponible → polling cada POLL_INTERVAL_MS.
 *   3. Al resolver o evaluar → refresca inmediatamente.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthContext } from '../lib/apiClient'
import {
  evaluateAlerts as apiEvaluateAlerts,
  getAlerts,
  resolveAlert as apiResolveAlert,
} from '../lib/alertsApi'
import { isV2FeatureEnabled } from '../lib/v2Features'

const POLL_INTERVAL_MS  = 30_000       // refresca lista cada 30s
const EVAL_INTERVAL_MS  = 5 * 60_000   // re-evalúa inventario cada 5 min
const SSE_RETRY_MS      = 5_000
const API_BASE          = import.meta.env.VITE_API_URL || ''
const ALERTS_ENABLED    = isV2FeatureEnabled('alerts')

export function useAlerts(localId) {
  const [alerts, setAlerts]           = useState([])
  const [loadedFor, setLoadedFor]     = useState(null) // localId cuya carga inicial terminó
  const [error, setError]             = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [sseAttempt, setSseAttempt]   = useState(0)    // se incrementa para reintentar SSE

  const tokenRef   = useRef(null)
  const mounted    = useRef(true)

  // ── Fetch list ──────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    if (!ALERTS_ENABLED || !localId) return
    try {
      const { token } = await getAuthContext()
      tokenRef.current = token
      const data = await getAlerts(localId, token)
      if (!mounted.current) return
      setAlerts(data || [])
      setPendingCount((data || []).filter((a) => a.status === 'pending').length)
      setError(null)
    } catch (err) {
      if (mounted.current) setError(err.message)
    }
  }, [localId])

  // ── Evaluate + fetch (silencioso) ───────────────────────────
  const silentEvaluate = useCallback(async () => {
    if (!ALERTS_ENABLED || !localId) return
    try {
      const { token } = await getAuthContext()
      await apiEvaluateAlerts(localId, token)
      await fetchAlerts()
    } catch {
      // silencioso — no interrumpir UX
    }
  }, [localId, fetchAlerts])

  // ── Bootstrap: evalúa al abrir, luego polling + evaluación periódica ──
  useEffect(() => {
    mounted.current = true
    if (!ALERTS_ENABLED || !localId) return

    let cancelled = false
    let pollId = null
    let evalId = null

    const bootstrap = async () => {
      // 1. Evalúa inventario al abrir la sección → genera/resuelve alertas del local
      await silentEvaluate()
      if (cancelled) return
      // 2. Habilita SSE (ver efecto siguiente) + polling + evaluación periódica
      setLoadedFor(localId)
      pollId = setInterval(fetchAlerts, POLL_INTERVAL_MS)
      evalId = setInterval(silentEvaluate, EVAL_INTERVAL_MS)
    }
    bootstrap()

    return () => {
      cancelled = true
      mounted.current = false
      clearInterval(pollId)
      clearInterval(evalId)
    }
  }, [localId, silentEvaluate, fetchAlerts])

  // ── SSE: una conexión por ejecución del efecto; reintentar = re-ejecutarlo ──
  const sseReady = ALERTS_ENABLED && Boolean(localId) && loadedFor === localId
  useEffect(() => {
    if (!sseReady || !tokenRef.current || !window.EventSource) return

    const url = `${API_BASE}/api/alerts/stream?local_id=${localId}&token=${encodeURIComponent(tokenRef.current)}`
    const es = new EventSource(url)
    let retryTimer = null

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.pending !== undefined) {
          setPendingCount(payload.pending)
          fetchAlerts()
        }
      } catch {
        // JSON parse error — ignorar
      }
    }

    es.onerror = () => {
      es.close()
      retryTimer = setTimeout(() => setSseAttempt((n) => n + 1), SSE_RETRY_MS)
    }

    return () => {
      es.close()
      clearTimeout(retryTimer)
    }
  }, [sseReady, localId, sseAttempt, fetchAlerts])

  // ── Acciones manuales ───────────────────────────────────────
  const resolveAlert = useCallback(async (alertId) => {
    if (!ALERTS_ENABLED) return
    const { token } = await getAuthContext()
    await apiResolveAlert(alertId, token)
    await fetchAlerts()
  }, [fetchAlerts])

  const evaluateAlerts = useCallback(async () => {
    if (!ALERTS_ENABLED) return { created: 0, resolved: 0 }
    const { token } = await getAuthContext()
    const result = await apiEvaluateAlerts(localId, token)
    await fetchAlerts()
    return result
  }, [localId, fetchAlerts])

  const loading = ALERTS_ENABLED && Boolean(localId) && loadedFor !== localId
  return { alerts, loading, error, pendingCount, resolveAlert, evaluateAlerts, refresh: fetchAlerts }
}
