/**
 * Recorte temporal de frontend para la demo del local "Rustik" (al paso):
 * solo venta directa (sin mesas/recetas) + finanzas. Scoped por email para
 * no afectar a otros Cajero/Empleado reales de otros negocios.
 */
export const DIRECT_SALE_EMAILS = ['rustik.demo@gestflow.dev']

export function isDirectSaleDemoUser(email) {
  return !!email && DIRECT_SALE_EMAILS.includes(String(email).toLowerCase())
}
