/**
 * Formatea un valor numérico como Peso Chileno (CLP).
 * CLP no usa decimales — los valores siempre son enteros.
 *
 * @param {number|string} value - Monto a formatear
 * @returns {string} Ej: 43000 → "43.000"
 *
 * Usar en JSX como: <span>${formatCLP(price)}</span>
 */
export function formatCLP(value) {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0))
}
