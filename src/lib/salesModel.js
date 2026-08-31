/** Modos de venta del local (Backend V2: locals.sales_model). */
export const SALES_MODEL = {
  RESTAURANT: 'RESTAURANT',
  AL_PASO: 'AL_PASO',
}

export const SALES_MODEL_LABEL = {
  RESTAURANT: 'Con mesas (restaurante)',
  AL_PASO: 'Comida al paso (caja + menú)',
}

export function normalizeSalesModel(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (raw === SALES_MODEL.RESTAURANT || raw === 'RESTAURANTE') return SALES_MODEL.RESTAURANT
  if (raw === SALES_MODEL.AL_PASO || raw === 'AL PASO' || raw === 'TAKEAWAY') return SALES_MODEL.AL_PASO
  return null
}

/** True si el local opera sin mesas (mostrador / comida al paso). */
export function isAlPasoLocal(localOrModel) {
  if (localOrModel == null) return false
  if (typeof localOrModel === 'string') {
    return normalizeSalesModel(localOrModel) === SALES_MODEL.AL_PASO
  }
  return normalizeSalesModel(localOrModel.sales_model) === SALES_MODEL.AL_PASO
}
