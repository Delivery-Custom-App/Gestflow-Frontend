import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Las cantidades vienen como decimal ("1.000", "0.500"): 1 se ve "1" y 0.5 se ve "0,5". */
export function formatCantidad(cantidad) {
  const n = Number(cantidad || 0)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-CL', { maximumFractionDigits: 3 })
}

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
