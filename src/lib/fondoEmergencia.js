/**
 * Fondo de emergencia del local (T-26 · T-27, backend B-09): plata apartada
 * para imprevistos, con un monto fijo, su saldo y un libro de movimientos.
 * Lo manejan el dueño (sus locales) y el encargado (el suyo); el vendedor no
 * lo ve y el superadmin solo puede consultarlo.
 *
 * Contrato (`/locals/{local_id}/fondo-emergencia`):
 * - `GET`  → { local_id, monto_fijo, saldo, semana_inicio, semana_fin,
 *   gastado_semana, fecha_minima, movimientos } (los movimientos desde
 *   `fecha_minima`). Sin fondo responde 200 con `monto_fijo = 0`.
 * - `PUT`  { monto_fijo } → define o cambia el monto fijo.
 * - `POST /movimientos` { tipo: 'gasto'|'reposicion', monto, motivo, fecha }.
 * - `GET  /movimientos?limit=&offset=` → todo el libro, del más nuevo al más
 *   antiguo; el total viene en `X-Total-Count`.
 * - `POST /movimientos/{id}/ajustes` { monto, motivo } → corrige un gasto.
 *
 * Reglas del backend: la semana va de lunes a domingo (hora de Chile); la
 * fecha va de `fecha_minima` a hoy (400 si no); un gasto no deja el saldo en
 * negativo (409); el motivo es obligatorio en gastos y ajustes (hasta 200
 * caracteres); los movimientos no se editan ni se borran, se corrigen con un
 * ajuste (409 si supera lo que queda por corregir o si la semana del gasto
 * ya cerró).
 */
import { apiRequest } from './apiClient'
import { normalizeRoleKey } from '../auth/roleLabel'

const ROLES_DEL_FONDO = new Set(['ADMINNEGOCIO', 'ADMIN', 'SUPERADMIN'])

/** El dueño, el encargado (y el superadmin, solo para leer) ven el fondo; el vendedor no. */
export function puedeManejarFondo(userRole) {
  return ROLES_DEL_FONDO.has(normalizeRoleKey(userRole))
}

export const MOTIVO_MAXIMO = 200

/** Cuántos movimientos trae cada página del historial. */
export const MOVIMIENTOS_POR_PAGINA = 20

export const TIPO_LABEL = { gasto: 'Gasto', reposicion: 'Reposición', ajuste: 'Corrección' }

/** Un gasto resta; una reposición y una corrección suman. */
export const restaSaldo = (tipo) => tipo === 'gasto'

/** "50.000" o "50000" → 50000; lo que no sea dígito se descarta. */
export function montoDesdeTexto(texto) {
  const limpio = String(texto ?? '').replace(/[^\d]/g, '')
  return limpio === '' ? null : Number(limpio)
}

/** Fecha de hoy en Chile (YYYY-MM-DD), la misma que usa el backend para la semana. */
export function hoyEnChile(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora)
  const parte = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

/** "2026-10-14" → "14/10/2026" (sin pasar por Date: no se corre de día). */
export function fechaCorta(iso) {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : '—'
}

const num = (v) => Number(v) || 0

/** Pasa la respuesta del backend a números para la pantalla. */
export function mapFondo(raw) {
  return {
    localId: raw.local_id,
    montoFijo: num(raw.monto_fijo),
    saldo: num(raw.saldo),
    semanaInicio: raw.semana_inicio,
    semanaFin: raw.semana_fin,
    gastadoSemana: num(raw.gastado_semana),
    fechaMinima: raw.fecha_minima,
    movimientos: (Array.isArray(raw.movimientos) ? raw.movimientos : []).map(mapMovimiento),
  }
}

export function mapMovimiento(m) {
  return {
    id: m.id,
    tipo: m.tipo,
    monto: num(m.monto),
    motivo: m.motivo || null,
    fecha: m.fecha,
    registradoEn: m.registrado_en,
    registradoPor: m.registrado_por_email || null,
    corrigeId: m.corrige_id || null,
    ajustado: m.ajustado == null ? null : num(m.ajustado),
  }
}

/** El local ya tiene fondo: monto fijo definido o algún movimiento. */
export function tieneFondo(fondo) {
  return Boolean(fondo) && (fondo.montoFijo > 0 || fondo.saldo !== 0 || fondo.movimientos.length > 0)
}

/** Cuánto falta reponer para volver al monto fijo (0 si está completo o sobra). */
export function faltaReponer(fondo) {
  return Math.max(0, fondo.montoFijo - fondo.saldo)
}

/** Lo que queda por corregir de un gasto (monto menos lo ya ajustado). */
export function porCorregir(gasto) {
  return Math.max(0, gasto.monto - (gasto.ajustado || 0))
}

/** Un gasto se puede corregir si queda algo y su fecha está dentro de la ventana. */
export function sePuedeCorregir(mov, fechaMinima) {
  return mov.tipo === 'gasto' && porCorregir(mov) > 0 && String(mov.fecha) >= String(fechaMinima)
}

// ── Validaciones (las mismas reglas que el backend, para avisar antes) ─────────

/** Definir el fondo: el monto fijo debe ser mayor que 0. */
export function validarMontoFijo(montoFijo) {
  if (!(montoFijo > 0)) return 'Indica el monto fijo del fondo (mayor que 0).'
  return null
}

/**
 * Gasto o reposición.
 * @param {{ tipo: 'gasto'|'reposicion', monto: number|null, motivo: string, fecha: string, fechaMinima: string, hoy: string, saldo: number }} mov
 */
export function validarMovimiento({ tipo, monto, motivo, fecha, fechaMinima, hoy, saldo }) {
  if (!(monto > 0)) return 'Indica un monto mayor que 0.'
  const texto = String(motivo || '').trim()
  if (tipo === 'gasto' && !texto) return 'Indica el motivo del gasto.'
  if (texto.length > MOTIVO_MAXIMO) return `El motivo puede tener hasta ${MOTIVO_MAXIMO} caracteres.`
  if (!fecha) return 'Indica la fecha.'
  if (fecha > hoy) return 'La fecha no puede ser futura.'
  if (fechaMinima && fecha < fechaMinima) return `La fecha debe ser desde el ${fechaCorta(fechaMinima)}.`
  if (tipo === 'gasto' && monto > saldo) return 'No alcanza: el fondo no puede quedar en negativo.'
  return null
}

/** Corrección de un gasto: motivo obligatorio y no más de lo que queda por corregir. */
export function validarAjuste({ monto, motivo, maximo }) {
  if (!(monto > 0)) return 'Indica un monto mayor que 0.'
  const texto = String(motivo || '').trim()
  if (!texto) return 'Indica el motivo de la corrección.'
  if (texto.length > MOTIVO_MAXIMO) return `El motivo puede tener hasta ${MOTIVO_MAXIMO} caracteres.`
  if (monto > maximo) return 'La corrección no puede ser mayor que lo que queda del gasto.'
  return null
}

/** Mensaje para la persona: el del backend sin el código ("409: …"). */
export function mensajeDeErrorDelFondo(error) {
  if (error?.isNetworkError) return error.message
  const status = Number(error?.status)
  const detalle = typeof error?.detail === 'string' ? error.detail : ''
  const texto = (detalle || String(error?.message || '')).replace(/^\d{3}:?\s*/, '')
  if (status === 403 && !detalle) return 'No tienes permiso para manejar el fondo de este local.'
  return texto || 'No se pudo completar la operación.'
}

// ── Llamadas al backend ──────────────────────────────────────────────────────

const ruta = (localId) => `/locals/${encodeURIComponent(String(localId))}/fondo-emergencia`

/** El fondo del local (sin fondo: monto fijo 0 y sin movimientos). */
export async function getFondo(localId) {
  return mapFondo(await apiRequest(ruta(localId)))
}

export async function definirMontoFijo(localId, montoFijo) {
  return mapFondo(await apiRequest(ruta(localId), { method: 'PUT', body: { monto_fijo: String(montoFijo) } }))
}

export async function registrarMovimiento(localId, { tipo, monto, motivo, fecha }) {
  const texto = String(motivo || '').trim()
  return mapMovimiento(await apiRequest(`${ruta(localId)}/movimientos`, {
    method: 'POST',
    body: { tipo, monto: String(monto), motivo: texto || null, fecha },
  }))
}

/**
 * Crea el fondo: define el monto fijo y registra una reposición por ese monto
 * para que el saldo parta completo.
 */
export async function crearFondo(localId, montoFijo, { hoy = hoyEnChile() } = {}) {
  await definirMontoFijo(localId, montoFijo)
  await registrarMovimiento(localId, { tipo: 'reposicion', monto: montoFijo, motivo: 'Fondo inicial', fecha: hoy })
  return getFondo(localId)
}

export async function corregirGasto(localId, gastoId, { monto, motivo }) {
  return mapMovimiento(await apiRequest(`${ruta(localId)}/movimientos/${encodeURIComponent(String(gastoId))}/ajustes`, {
    method: 'POST',
    body: { monto: String(monto), motivo: String(motivo || '').trim() },
  }))
}

/** Una página del historial completo: { movimientos, total }. */
export async function listarHistorial(localId, { limit = MOVIMIENTOS_POR_PAGINA, offset = 0 } = {}) {
  const { data, total } = await apiRequest(`${ruta(localId)}/movimientos?limit=${limit}&offset=${offset}`, { withTotal: true })
  const movimientos = (Array.isArray(data) ? data : []).map(mapMovimiento)
  return { movimientos, total: total ?? movimientos.length }
}
