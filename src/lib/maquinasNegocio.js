/**
 * Máquinas POS de todo el negocio, para el dueño (T-44, R8; secciones 5b y 6).
 *
 * - `GET /pos-machines/negocio` → { mercadopago_conectado, registradas,
 *   sin_registrar, aviso }. `registradas`: local, caja física, proveedor,
 *   terminal y ocupación; `sin_registrar`: terminales que Mercado Pago ve y
 *   GestFlow no. Si Mercado Pago no responde, `aviso` explica por qué y
 *   `registradas` viene igual.
 * - `POST /pos-machines/{id}/mover` con `local_id` y, en un local al paso,
 *   `caja_fisica_id`. Queda libre en el destino. 409 si un turno de hoy la
 *   usa o tiene un cobro pendiente.
 * - Registrar una terminal: `POST /webhooks/mercadopago-pos` con
 *   `mp_pos_id`, `local_id` y `name`.
 */
import { apiRequest } from './apiClient'

export function listarMaquinasDelNegocio() {
  return apiRequest('/pos-machines/negocio')
}

export function moverMaquina(machineId, { localId, cajaFisicaId = null }) {
  return apiRequest(`/pos-machines/${encodeURIComponent(String(machineId))}/mover`, {
    method: 'POST',
    body: { local_id: String(localId), ...(cajaFisicaId ? { caja_fisica_id: String(cajaFisicaId) } : {}) },
  })
}

export function registrarTerminal({ terminalId, localId, nombre }) {
  return apiRequest('/webhooks/mercadopago-pos', {
    method: 'POST',
    body: { mp_pos_id: String(terminalId), local_id: String(localId), name: String(nombre || '').trim() || null },
  })
}

/** Registradas agrupadas por local: [{ localId, localName, maquinas }]. */
export function agruparPorLocal(registradas = []) {
  const grupos = new Map()
  for (const m of registradas) {
    const clave = String(m.local_id || 'sin-local')
    if (!grupos.has(clave)) grupos.set(clave, { localId: m.local_id, localName: m.local_name || 'Sin local', maquinas: [] })
    grupos.get(clave).maquinas.push(m)
  }
  return [...grupos.values()].sort((a, b) => a.localName.localeCompare(b.localName, 'es'))
}

/** «Libre», «En uso: Ana» o «Llena: Ana y Luis». */
export function textoOcupacion(m) {
  const usuarios = Array.isArray(m?.usuarios) ? m.usuarios : []
  if (!m?.ocupacion) return 'Libre'
  return `${m.ocupacion >= 2 ? 'Llena' : 'En uso'}: ${usuarios.join(' y ') || `${m.ocupacion} persona(s)`}`
}

export function mensajeMaquinas(err) {
  return String(err?.detail || err?.message || 'No se pudo completar').replace(/^\d{3}:\s*/, '')
}
