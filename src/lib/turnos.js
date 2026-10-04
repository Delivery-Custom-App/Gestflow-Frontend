/**
 * Lo que responde el backend al cerrar un turno, en palabras de quien lo
 * cierra. `PATCH /cajas/{id}` responde 409 si quedan órdenes en curso y 400
 * si el turno ya estaba cerrado.
 */
export function mensajeCierreTurno(err) {
  const texto = String(err?.message || '')
  if (/órdenes en curso|ordenes en curso|409/i.test(texto)) {
    return 'No se puede cerrar el turno: todavía hay órdenes en curso. Cóbralas o cancélalas primero.'
  }
  if (/ya está cerrada/i.test(texto)) return 'Este turno ya estaba cerrado.'
  return texto || 'No se pudo cerrar el turno'
}
