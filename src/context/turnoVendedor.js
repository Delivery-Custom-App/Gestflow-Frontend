import { createContext, useContext } from 'react'

/**
 * Turno del vendedor mientras trabaja: lo provee `InicioDeTurno`, que solo
 * deja entrar al vendedor con su turno de hoy abierto. Fuera de la vista del
 * vendedor no hay proveedor y `useTurnoVendedor()` devuelve null.
 *
 * Valor: { turno, alCerrar } — `alCerrar()` avisa que el turno se cerró, para
 * volver a preguntar "¿Iniciar turno?".
 */
export const TurnoVendedorContext = createContext(null)

export function useTurnoVendedor() {
  return useContext(TurnoVendedorContext)
}
