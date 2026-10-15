/**
 * Importar productos desde una planilla (T-60, B3 y B15 sección 5f).
 *
 * - Plantilla: `GET /products/import/template` (un .xlsx con los encabezados
 *   Nombre, Precio, Costo, Categoría, Código, Descripción y Stock).
 * - Subida: `POST /products/import` (multipart) con `file` y el `local_id` del
 *   local activo, que recibe el menú y el stock. Responde 202 con el trabajo.
 * - Resultado: `GET /products/import/{job_id}` hasta `completed` o `failed`:
 *   `total_rows`, `succeeded_rows` (incluye las actualizadas), `updated_rows`,
 *   `failed_rows` y `errors` [{row, error}] (`row` es la fila de la planilla;
 *   `row: 0`, un error del archivo entero).
 * Un producto se identifica por Código o, sin código, por Nombre: si ya existe
 * se actualiza en vez de duplicarse.
 */
import { apiRequest, getAuthContext } from './apiClient'

export const MAX_BYTES_PLANILLA = 5 * 1024 * 1024
const EXTENSIONES = ['.xlsx', '.csv']
const apiBaseUrl = import.meta.env.VITE_API_URL || ''
const url = (ruta) => `${apiBaseUrl}/api${ruta}`

/** Primer problema del archivo antes de subirlo, o null. */
export function validarPlanilla(file) {
  if (!file) return 'Elige el archivo de la planilla.'
  const nombre = String(file.name || '').toLowerCase()
  if (!EXTENSIONES.some((e) => nombre.endsWith(e))) return 'El archivo debe ser .xlsx o .csv separado por punto y coma.'
  if (file.size > MAX_BYTES_PLANILLA) return 'El archivo pesa más de 5 MB: divídelo en partes.'
  return null
}

async function errorDeRespuesta(response) {
  const json = await response.json().catch(() => null)
  const detail = typeof json?.detail === 'string' ? json.detail : null
  const err = new Error(detail || `No se pudo completar (${response.status})`)
  err.status = response.status
  err.detail = detail
  return err
}

/** Descarga la plantilla .xlsx del backend. */
export async function descargarPlantilla() {
  const { token } = await getAuthContext()
  const response = await fetch(url('/products/import/template'), { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw await errorDeRespuesta(response)
  const blob = await response.blob()
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = 'plantilla_productos.xlsx'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(enlace.href)
}

/** Sube la planilla para el local; devuelve el trabajo de importación (202). */
export async function subirPlanilla(file, localId) {
  const problema = validarPlanilla(file)
  if (problema) throw new Error(problema)
  const { token } = await getAuthContext()
  const form = new FormData()
  form.append('file', file)
  if (localId) form.append('local_id', String(localId))
  const response = await fetch(url('/products/import'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!response.ok) throw await errorDeRespuesta(response)
  return response.json()
}

export function consultarImportacion(jobId) {
  return apiRequest(`/products/import/${encodeURIComponent(String(jobId))}`)
}

const TERMINADOS = new Set(['completed', 'failed'])

/** Consulta el trabajo hasta que termine (completed o failed). */
export async function esperarImportacion(trabajo, { intervaloMs = 1500, maxIntentos = 120, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let actual = trabajo
  for (let i = 0; i < maxIntentos && !TERMINADOS.has(actual?.status); i += 1) {
    // Secuencial a propósito: cada consulta depende de si el trabajo terminó.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    await esperar(intervaloMs)
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    actual = await consultarImportacion(actual.id)
  }
  return actual
}

/** Resumen para la pantalla: creadas, actualizadas, con error y la lista de errores. */
export function resumenImportacion(job) {
  const exitosas = Number(job?.succeeded_rows) || 0
  const actualizadas = Number(job?.updated_rows) || 0
  const errores = (Array.isArray(job?.errors) ? job.errors : []).map((e) => ({
    fila: Number(e.row) || 0,
    texto: Number(e.row) === 0 ? `Archivo: ${e.error}` : `Fila ${e.row}: ${e.error}`,
  }))
  return {
    estado: job?.status,
    creadas: Math.max(0, exitosas - actualizadas),
    actualizadas,
    conError: Number(job?.failed_rows) || 0,
    errores,
  }
}
