/**
 * Roles que pueden usar endpoints de inventario/admin restringidos (p. ej. KPIs de proveedores).
 * @param {string|null|undefined} roleLabel Rol mostrado en UI (p. ej. tras formatRoleLabel).
 */
export function isInventoryAdminRole(roleLabel) {
  if (!roleLabel) return false
  const n = String(roleLabel).toLowerCase().replace(/\s+/g, '')
  return n === 'superadmin' || n === 'admin'
}
