/**
 * La caja física manda (#133 y #140; backend #42, #40 y #49).
 *
 * La apertura y el cierre (el fondo, el conteo de billetes y el cuadre) son de
 * la caja física, no del turno de un empleado. Cada vez que el encargado o el
 * dueño abre una caja nace una «apertura»; al cerrarla, esa apertura queda
 * cerrada con lo contado, lo esperado y la diferencia. Los turnos de los
 * empleados cuelgan de la apertura que estaba abierta cuando empezaron.
 *
 * - `GET /cajas-fisicas?local_id=`: cada caja trae `abierta`, `apertura_actual`
 *   y (encargado y dueño) `ultimo_cierre`. El empleado la ve sin montos.
 * - `POST /cajas-fisicas/{id}/abrir`: `apertura_desglose` (obligatorio; vacío es
 *   $0) y `nota_apertura` (obligatoria si no coincide con el último cierre: 422).
 * - `GET /cajas-fisicas/{id}/cierre`: revisión antes de contar (no cierra nada):
 *   `pedidos_abiertos`, `cobro_en_curso`, `turnos_abiertos` y `puede_contar`.
 * - `POST /cajas-fisicas/{id}/cerrar`: `cierre_desglose` (obligatorio) y
 *   `nota_cierre` (obligatoria si hay diferencia: 422). El conteo es a ciegas.
 * - `POST /cajas-fisicas/{id}/movimientos`: `ingreso` o `egreso` (retiro, con
 *   nota obligatoria). La caja no tiene gastos: salen del fondo de emergencia.
 * - `GET /cajas-fisicas/{id}/aperturas`, `…/aperturas/{id}/resumen` y
 *   `…/aperturas/{id}/movimientos`: historial, resumen y movimientos.
 * - `PATCH /pos-machines/{id}` con `caja_fisica_id`: asignar la caja a una
 *   máquina (solo cajas activas: 400 si está desactivada).
 */
import { apiRequest } from './apiClient'
import { totalesDelConteo } from './efectivo'

const ruta = (id) => `/cajas-fisicas/${encodeURIComponent(String(id))}`
const lista = (v) => (Array.isArray(v) ? v : [])
const numero = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Billetes y monedas contados → lo que pide el backend: solo las denominaciones con cantidad. */
export function desgloseParaApi(cantidades) {
  return totalesDelConteo(cantidades).filas
    .filter((f) => f.cantidad > 0)
    .map((f) => ({ denominacion: f.valor, tipo: f.tipo, cantidad: f.cantidad }))
}

/** Las cajas físicas del local con su estado (abierta, apertura actual y último cierre). */
export async function listarCajasFisicasDelLocal(localId) {
  const filas = await apiRequest(`/cajas-fisicas?local_id=${encodeURIComponent(String(localId))}`)
  return lista(filas).map((c) => ({ ...c, name: c.nombre ?? c.name ?? null }))
}

/** Las que un empleado puede elegir para iniciar su turno: activas y abiertas ahora. */
export function cajasAbiertas(cajas) {
  return lista(cajas).filter((c) => c.is_active !== false && c.abierta === true)
}

/** Lo que dejó el último cierre de la caja, para comparar al abrir: { contado, cerradaAt, cerro } o null. */
export function ultimoCierreDe(caja) {
  const u = caja?.ultimo_cierre
  const contado = numero(u?.monto_cierre_declarado)
  if (!u || contado === null) return null
  return { contado, cerradaAt: u.cerrada_at || null, cerro: u.cerrada_por_email || null }
}

export function abrirCajaFisica(cajaFisicaId, { cantidades, nota = '' } = {}) {
  const limpia = String(nota || '').trim()
  return apiRequest(`${ruta(cajaFisicaId)}/abrir`, {
    method: 'POST',
    body: { apertura_desglose: desgloseParaApi(cantidades), ...(limpia ? { nota_apertura: limpia } : {}) },
  })
}

export function revisarCierreCajaFisica(cajaFisicaId) {
  return apiRequest(`${ruta(cajaFisicaId)}/cierre`)
}

export function cerrarCajaFisica(cajaFisicaId, { cantidades, nota = '' } = {}) {
  const limpia = String(nota || '').trim()
  return apiRequest(`${ruta(cajaFisicaId)}/cerrar`, {
    method: 'POST',
    body: { cierre_desglose: desgloseParaApi(cantidades), ...(limpia ? { nota_cierre: limpia } : {}) },
  })
}

export const APERTURAS_POR_PAGINA = 10

export async function listarAperturas(cajaFisicaId, { offset = 0, limit = APERTURAS_POR_PAGINA } = {}) {
  const { data, total } = await apiRequest(`${ruta(cajaFisicaId)}/aperturas?limit=${limit}&offset=${offset}`, { withTotal: true })
  return { aperturas: lista(data), total: total ?? lista(data).length }
}

export function resumenDeApertura(aperturaId) {
  return apiRequest(`/cajas-fisicas/aperturas/${encodeURIComponent(String(aperturaId))}/resumen`)
}

/** Ingreso o retiro del cajón de una caja abierta (anotado en su apertura). */
export function registrarMovimientoCajaFisica(cajaFisicaId, { tipo, monto, note = '', paymentMethod = 'cash' }) {
  const limpia = String(note || '').trim()
  return apiRequest(`${ruta(cajaFisicaId)}/movimientos`, {
    method: 'POST',
    body: { tipo, monto: Number(monto), payment_method: paymentMethod, ...(limpia ? { note: limpia } : {}) },
  })
}

/** Primer problema del ingreso o retiro, o null. */
export function validarMovimientoCajaFisica({ tipo, monto, note }) {
  if (tipo !== 'ingreso' && tipo !== 'egreso') return 'Elige si es un ingreso o un retiro.'
  if (!(Number(monto) > 0)) return 'Indica un monto mayor que $0.'
  if (tipo === 'egreso' && String(note || '').trim().length < 3) return 'Un retiro necesita una nota que diga a dónde fue la plata.'
  return null
}

/** Asigna (o cambia) la caja física de una máquina POS. */
export function asignarCajaAMaquina(machineId, cajaFisicaId) {
  return apiRequest(`/pos-machines/${encodeURIComponent(String(machineId))}`, {
    method: 'PATCH',
    body: { caja_fisica_id: cajaFisicaId ? String(cajaFisicaId) : null },
  })
}

/**
 * El resumen de una apertura para la pantalla y el comprobante (misma forma
 * que `armarResumenCierre`): fondo, ventas por medio, ingresos, retiros,
 * esperado, contado y diferencia.
 */
export function resumenParaPantalla(resumen) {
  const v = resumen?.ventas_por_medio
  return {
    fondo: numero(resumen?.fondo),
    ventas: v ? { efectivo: numero(v.efectivo) ?? 0, tarjeta: numero(v.tarjeta) ?? 0, transferencia: numero(v.transferencia) ?? 0, otros: numero(v.otros) ?? 0 } : null,
    ingresosCaja: numero(resumen?.total_ingresos_manuales),
    retiros: numero(resumen?.total_retiros),
    esperado: numero(resumen?.efectivo_esperado),
    contado: numero(resumen?.monto_cierre_declarado),
    diferencia: numero(resumen?.diferencia),
  }
}

/** El error del backend en palabras, sin el código ni el nombre de los campos. */
export function mensajeCajaFisica(err, porDefecto = 'No se pudo completar') {
  return String(err?.detail || err?.message || porDefecto)
    .replace(/^\d{3}:\s*/, '')
    .replace(/en nota_(apertura|cierre)/, 'en la nota')
}

/** ¿El 422 es porque falta la nota (lo contado no coincide)? */
export function faltaNota(err) {
  return Number(err?.status) === 422 && /nota_(apertura|cierre)/.test(String(err?.detail || err?.message || ''))
}
