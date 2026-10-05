/**
 * "Este producto se prepara": el tipo de producto del backend
 * (`stock_deduction_mode`).
 *
 * - Se prepara (RECIPE_BASED): va a la comanda de cocina y no lleva stock por
 *   unidades. El backend rechaza su fila de inventario.
 * - No se prepara (DIRECT_STOCK): se cuenta por unidades y se descuenta del
 *   stock al venderlo. En los locales con mesas no va a la comanda; en comida
 *   al paso, la comanda lleva todo.
 */
export const SE_PREPARA = 'RECIPE_BASED'
export const POR_UNIDADES = 'DIRECT_STOCK'

export function sePrepara(producto) {
  return producto?.stock_deduction_mode === SE_PREPARA
}

export function modoDeStock(prepara) {
  return prepara ? SE_PREPARA : POR_UNIDADES
}

/** La línea que explica qué cambia con el switch. */
export function explicacionSePrepara(prepara) {
  return prepara
    ? 'Va a la comanda de cocina y no lleva stock por unidades.'
    : 'Se cuenta por unidades: se descuenta del stock al venderlo. En locales con mesas no va a la comanda.'
}
