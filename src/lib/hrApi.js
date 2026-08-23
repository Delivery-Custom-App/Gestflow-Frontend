/**
 * Adaptadores Frontend → Backend V2 (RRHH).
 */
import { apiRequest } from './apiClient'

function withQuery(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value))
    }
  }
  const q = qs.toString()
  return q ? `${path}?${q}` : path
}

export const PAY_FREQUENCIES = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
]

export const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'sick', label: 'Licencia médica' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Otro' },
]

export function formatPayFrequency(value) {
  return PAY_FREQUENCIES.find((p) => p.value === value)?.label || value
}

export function formatLeaveType(value) {
  return LEAVE_TYPES.find((t) => t.value === value)?.label || value
}

export function formatEmployeeStatus(value) {
  const map = { active: 'Activo', inactive: 'Inactivo', terminated: 'Terminado' }
  return map[value] || value
}

export function formatLeaveStatus(value) {
  const map = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' }
  return map[value] || value
}

export function formatShiftStatus(value) {
  const map = {
    scheduled: 'Programado',
    in_progress: 'En curso',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }
  return map[value] || value
}

export function formatPayrollStatus(value) {
  const map = { draft: 'Borrador', approved: 'Aprobado', paid: 'Pagado' }
  return map[value] || value
}

export async function listEmployees() {
  const rows = await apiRequest('/employees')
  return Array.isArray(rows) ? rows : []
}

export async function getMyEmployee() {
  return apiRequest('/employees/me')
}

export async function getEmployee(employeeId) {
  return apiRequest(`/employees/${encodeURIComponent(String(employeeId))}`)
}

export async function createEmployee(body) {
  return apiRequest('/employees', {
    method: 'POST',
    body: {
      user_id: body.user_id,
      business_id: body.business_id || null,
      rut: String(body.rut || '').trim(),
      full_name: String(body.full_name || '').trim(),
      cargo: String(body.cargo || '').trim(),
      fecha_ingreso: body.fecha_ingreso,
      pay_frequency: body.pay_frequency,
      base_salary: Number(body.base_salary) || 0,
      status: body.status || 'active',
      primary_local_id: body.primary_local_id || null,
    },
  })
}

export async function updateEmployee(employeeId, body) {
  return apiRequest(`/employees/${encodeURIComponent(String(employeeId))}`, {
    method: 'PATCH',
    body,
  })
}

export async function listEmployeeLocals(employeeId) {
  const rows = await apiRequest(`/employees/${encodeURIComponent(String(employeeId))}/locals`)
  return Array.isArray(rows) ? rows : []
}

export async function assignEmployeeLocal(employeeId, { local_id, is_primary = false }) {
  return apiRequest(`/employees/${encodeURIComponent(String(employeeId))}/locals`, {
    method: 'POST',
    body: { local_id, is_primary },
  })
}

/** Empleados asignados a un local (compuesto en FE). */
export async function listEmployeesForLocal(localId) {
  const employees = await listEmployees()
  const withLocals = await Promise.all(
    employees.map(async (emp) => {
      try {
        const locals = await listEmployeeLocals(emp.id)
        return { ...emp, local_assignments: locals }
      } catch {
        return { ...emp, local_assignments: [] }
      }
    }),
  )
  return withLocals.filter((emp) =>
    emp.local_assignments.some((a) => String(a.local_id) === String(localId)),
  )
}

export async function listShifts({ local_id, employee_id } = {}) {
  const rows = await apiRequest(withQuery('/shifts', { local_id, employee_id }))
  return Array.isArray(rows) ? rows : []
}

export async function createShift(body) {
  return apiRequest('/shifts', {
    method: 'POST',
    body: {
      employee_id: body.employee_id,
      local_id: body.local_id,
      scheduled_start: body.scheduled_start,
      scheduled_end: body.scheduled_end,
    },
  })
}

export async function updateShift(shiftId, body) {
  return apiRequest(`/shifts/${encodeURIComponent(String(shiftId))}`, {
    method: 'PATCH',
    body,
  })
}

export async function listPayrollPeriods(employeeId) {
  const rows = await apiRequest(withQuery('/payroll-periods', { employee_id: employeeId }))
  return Array.isArray(rows) ? rows : []
}

export async function createPayrollPeriod(body) {
  return apiRequest('/payroll-periods', {
    method: 'POST',
    body: {
      employee_id: body.employee_id,
      period_start: body.period_start,
      period_end: body.period_end,
      gross_amount: Number(body.gross_amount) || 0,
      deductions: Number(body.deductions) || 0,
    },
  })
}

export async function updatePayrollPeriod(periodId, body) {
  return apiRequest(`/payroll-periods/${encodeURIComponent(String(periodId))}`, {
    method: 'PATCH',
    body,
  })
}

export async function listLeaveRequests(employeeId) {
  const rows = await apiRequest(withQuery('/leave-requests', { employee_id: employeeId }))
  return Array.isArray(rows) ? rows : []
}

export async function createLeaveRequest(body) {
  const payload = {
    type: body.type,
    date_from: body.date_from,
    date_to: body.date_to,
    note: body.note || null,
  }
  if (body.employee_id) payload.employee_id = body.employee_id
  return apiRequest('/leave-requests', { method: 'POST', body: payload })
}

export async function resolveLeaveRequest(requestId, { status, note }) {
  return apiRequest(`/leave-requests/${encodeURIComponent(String(requestId))}/status`, {
    method: 'PATCH',
    body: { status, note: note || null },
  })
}
