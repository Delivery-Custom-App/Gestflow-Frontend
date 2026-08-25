/**
 * Cliente API para el módulo de alertas administrativas.
 * Cubre listado, conteo, evaluación automática y resolución de alertas.
 */

import { apiRequest } from './apiClient'
import { isV2FeatureEnabled } from './v2Features'

function withQuery(path, params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function alertsUnavailable() {
  return !isV2FeatureEnabled('alerts')
}

/** Listar alertas de un local. status: 'pending' | 'resolved' | undefined */
export function getAlerts(localId, token, alertStatus) {
  if (alertsUnavailable()) return Promise.resolve([])
  const path = withQuery('/alerts', { local_id: localId, status: alertStatus })
  return apiRequest(path, { token })
}

/** Conteo rápido de alertas pendientes (para badge del header). */
export function getAlertsCount(localId, token) {
  if (alertsUnavailable()) return Promise.resolve({ count: 0 })
  const path = withQuery('/alerts/count', { local_id: localId })
  return apiRequest(path, { token })
}

/** Ejecutar el motor de reglas del backend para un local y generar alertas si aplica. */
export function evaluateAlerts(localId, token) {
  if (alertsUnavailable()) return Promise.resolve({ created: 0, resolved: 0 })
  const path = withQuery('/alerts/evaluate', { local_id: localId })
  return apiRequest(path, { method: 'POST', token })
}

/** Crear alerta manualmente (admin). */
export function createAlert(body, token) {
  if (alertsUnavailable()) {
    return Promise.reject(new Error('Alertas aún no disponibles en Backend V2'))
  }
  return apiRequest('/alerts', { method: 'POST', body, token })
}

/** Marcar una alerta como resuelta (cambia status pending → resolved). */
export function resolveAlert(alertId, token) {
  if (alertsUnavailable()) {
    return Promise.reject(new Error('Alertas aún no disponibles en Backend V2'))
  }
  return apiRequest(`/alerts/${alertId}/resolve`, { method: 'PATCH', token })
}

/** Marcar que se realizó un pedido para resolver esta alerta (actualiza metadata). */
export function markOrderPlaced(alertId, token) {
  if (alertsUnavailable()) {
    return Promise.reject(new Error('Alertas aún no disponibles en Backend V2'))
  }
  return apiRequest(`/alerts/${alertId}/order-placed`, { method: 'PATCH', token })
}
