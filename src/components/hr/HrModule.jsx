import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEmployees } from '../hooks/useEmployees'
import { useShifts } from '../hooks/useShifts'
import { useLeaveRequests } from '../hooks/useLeaveRequests'
import { listUsers } from '../lib/apiClient'
import { fetchLocal } from '../lib/salesApi'
import {
  formatEmployeeStatus,
  formatLeaveStatus,
  formatLeaveType,
  formatPayFrequency,
  formatShiftStatus,
  LEAVE_TYPES,
  PAY_FREQUENCIES,
} from '../lib/hrApi'
import { isAdminNegocioRole, isSuperAdminRole } from '../auth/roleLabel'
import { formatCLPDisplay } from '../lib/formatCLP'
import LoadingSpinner from './LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, FileText } from 'lucide-react'

const TABS = [
  { id: 'empleados', label: 'Empleados', icon: Users },
  { id: 'turnos', label: 'Turnos', icon: Calendar },
  { id: 'permisos', label: 'Permisos', icon: FileText },
]

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function HrModule() {
  const { localId } = useParams()
  const { userRole } = useAuth()
  const canManageHr = isSuperAdminRole(userRole) || isAdminNegocioRole(userRole)
  const [tab, setTab] = useState(canManageHr ? 'empleados' : 'permisos')

  const { employees, loading: empLoading, error: empError, addEmployee, refetch: refetchEmp } = useEmployees(localId)
  const { shifts, loading: shiftLoading, error: shiftError, addShift, refetch: refetchShifts } = useShifts(localId)
  const { requests, loading: leaveLoading, error: leaveError, submitRequest, decideRequest, refetch: refetchLeave } = useLeaveRequests()

  const [empForm, setEmpForm] = useState({
    user_id: '',
    rut: '',
    full_name: '',
    cargo: '',
    fecha_ingreso: todayIsoDate(),
    pay_frequency: 'monthly',
    base_salary: '',
  })
  const [shiftForm, setShiftForm] = useState({
    employee_id: '',
    scheduled_start: '',
    scheduled_end: '',
  })
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '',
    type: 'vacation',
    date_from: todayIsoDate(),
    date_to: todayIsoDate(),
    note: '',
  })
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ id: e.id, label: e.full_name })),
    [employees],
  )

  const loadUsers = async () => {
    if (!canManageHr || users.length) return
    try {
      const local = await fetchLocal(localId)
      const rows = await listUsers(local.business_id)
      setUsers(Array.isArray(rows) ? rows : [])
    } catch {
      setUsers([])
    }
  }

  const handleCreateEmployee = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const local = await fetchLocal(localId)
      await addEmployee({
        ...empForm,
        business_id: local.business_id,
        base_salary: Number(empForm.base_salary) || 0,
        primary_local_id: localId,
      })
      setMsg('Ficha de empleado creada.')
      setEmpForm((f) => ({ ...f, rut: '', full_name: '', cargo: '', base_salary: '' }))
      refetchEmp()
    } catch (error) {
      setErr(error.message || 'No se pudo crear la ficha')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateShift = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      await addShift({
        employee_id: shiftForm.employee_id,
        local_id: localId,
        scheduled_start: new Date(shiftForm.scheduled_start).toISOString(),
        scheduled_end: new Date(shiftForm.scheduled_end).toISOString(),
      })
      setMsg('Turno creado.')
      setShiftForm({ employee_id: '', scheduled_start: '', scheduled_end: '' })
      refetchShifts()
    } catch (error) {
      setErr(error.message || 'No se pudo crear el turno')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateLeave = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const body = { ...leaveForm }
      if (!canManageHr) delete body.employee_id
      else if (!body.employee_id) delete body.employee_id
      await submitRequest(body)
      setMsg('Solicitud de permiso enviada.')
      refetchLeave()
    } catch (error) {
      setErr(error.message || 'No se pudo enviar la solicitud')
    } finally {
      setBusy(false)
    }
  }

  const handleDecide = async (requestId, status) => {
    setErr('')
    setBusy(true)
    try {
      await decideRequest(requestId, status)
      setMsg(status === 'approved' ? 'Permiso aprobado.' : 'Permiso rechazado.')
    } catch (error) {
      setErr(error.message || 'No se pudo actualizar la solicitud')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-black text-[hsl(var(--foreground))]">Recursos Humanos</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Fichas, turnos y permisos (Backend V2).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(canManageHr ? TABS : TABS.filter((t) => t.id === 'permisos')).map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={tab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTab(id); setErr(''); setMsg('') }}
          >
            <Icon size={16} className="mr-1.5" />
            {label}
          </Button>
        ))}
      </div>

      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

      {tab === 'empleados' && (
        <div className="space-y-4">
          {canManageHr && (
            <Card>
              <CardHeader><CardTitle className="text-base">Nueva ficha de empleado</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateEmployee} onFocus={loadUsers}>
                  <div>
                    <Label>Usuario vinculado</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                      value={empForm.user_id}
                      onChange={(e) => setEmpForm((f) => ({ ...f, user_id: e.target.value }))}
                      required
                    >
                      <option value="">Selecciona usuario…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div><Label>RUT</Label><Input value={empForm.rut} onChange={(e) => setEmpForm((f) => ({ ...f, rut: e.target.value }))} required /></div>
                  <div><Label>Nombre completo</Label><Input value={empForm.full_name} onChange={(e) => setEmpForm((f) => ({ ...f, full_name: e.target.value }))} required /></div>
                  <div><Label>Cargo</Label><Input value={empForm.cargo} onChange={(e) => setEmpForm((f) => ({ ...f, cargo: e.target.value }))} required /></div>
                  <div><Label>Fecha ingreso</Label><Input type="date" value={empForm.fecha_ingreso} onChange={(e) => setEmpForm((f) => ({ ...f, fecha_ingreso: e.target.value }))} required /></div>
                  <div>
                    <Label>Frecuencia de pago</Label>
                    <select className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm" value={empForm.pay_frequency} onChange={(e) => setEmpForm((f) => ({ ...f, pay_frequency: e.target.value }))}>
                      {PAY_FREQUENCIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div><Label>Sueldo base (CLP)</Label><Input type="number" min="0" value={empForm.base_salary} onChange={(e) => setEmpForm((f) => ({ ...f, base_salary: e.target.value }))} required /></div>
                  <div className="md:col-span-2"><Button type="submit" disabled={busy}>Crear ficha</Button></div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Empleados del local</CardTitle></CardHeader>
            <CardContent>
              {empLoading ? <LoadingSpinner /> : empError ? <p className="text-sm text-red-600">{empError}</p> : employees.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay fichas HR para este local.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left border-b"><th className="py-2 pr-3">Nombre</th><th className="py-2 pr-3">Cargo</th><th className="py-2 pr-3">RUT</th><th className="py-2 pr-3">Pago</th><th className="py-2">Estado</th></tr></thead>
                    <tbody>
                      {employees.map((e) => (
                        <tr key={e.id} className="border-b border-[hsl(var(--border))]">
                          <td className="py-2 pr-3 font-medium">{e.full_name}</td>
                          <td className="py-2 pr-3">{e.cargo}</td>
                          <td className="py-2 pr-3">{e.rut}</td>
                          <td className="py-2 pr-3">{formatPayFrequency(e.pay_frequency)} · {formatCLPDisplay(Number(e.base_salary))}</td>
                          <td className="py-2"><Badge variant="secondary">{formatEmployeeStatus(e.status)}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'turnos' && (
        <div className="space-y-4">
          {canManageHr && (
            <Card>
              <CardHeader><CardTitle className="text-base">Programar turno</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateShift}>
                  <div>
                    <Label>Empleado</Label>
                    <select className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm" value={shiftForm.employee_id} onChange={(e) => setShiftForm((f) => ({ ...f, employee_id: e.target.value }))} required>
                      <option value="">Selecciona…</option>
                      {employeeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <div><Label>Inicio</Label><Input type="datetime-local" value={shiftForm.scheduled_start} onChange={(e) => setShiftForm((f) => ({ ...f, scheduled_start: e.target.value }))} required /></div>
                  <div><Label>Fin</Label><Input type="datetime-local" value={shiftForm.scheduled_end} onChange={(e) => setShiftForm((f) => ({ ...f, scheduled_end: e.target.value }))} required /></div>
                  <div className="md:col-span-2"><Button type="submit" disabled={busy || !employeeOptions.length}>Crear turno</Button></div>
                </form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Turnos del local</CardTitle></CardHeader>
            <CardContent>
              {shiftLoading ? <LoadingSpinner /> : shiftError ? <p className="text-sm text-red-600">{shiftError}</p> : shifts.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin turnos programados.</p>
              ) : (
                <div className="space-y-2">
                  {shifts.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                      <span>{new Date(s.scheduled_start).toLocaleString('es-CL')} → {new Date(s.scheduled_end).toLocaleString('es-CL')}</span>
                      <Badge variant="outline">{formatShiftStatus(s.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'permisos' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Solicitar permiso</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateLeave}>
                {canManageHr && (
                  <div>
                    <Label>Empleado (opcional)</Label>
                    <select className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm" value={leaveForm.employee_id} onChange={(e) => setLeaveForm((f) => ({ ...f, employee_id: e.target.value }))}>
                      <option value="">Mi ficha (empleado)</option>
                      {employeeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <Label>Tipo</Label>
                  <select className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm" value={leaveForm.type} onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))}>
                    {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div><Label>Desde</Label><Input type="date" value={leaveForm.date_from} onChange={(e) => setLeaveForm((f) => ({ ...f, date_from: e.target.value }))} required /></div>
                <div><Label>Hasta</Label><Input type="date" value={leaveForm.date_to} onChange={(e) => setLeaveForm((f) => ({ ...f, date_to: e.target.value }))} required /></div>
                <div className="md:col-span-2"><Label>Nota</Label><Input value={leaveForm.note} onChange={(e) => setLeaveForm((f) => ({ ...f, note: e.target.value }))} /></div>
                <div className="md:col-span-2"><Button type="submit" disabled={busy}>Enviar solicitud</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Solicitudes</CardTitle></CardHeader>
            <CardContent>
              {leaveLoading ? <LoadingSpinner /> : leaveError ? <p className="text-sm text-red-600">{leaveError}</p> : requests.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay solicitudes.</p>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{formatLeaveType(r.type)} · {r.date_from} → {r.date_to}</span>
                        <Badge variant="outline">{formatLeaveStatus(r.status)}</Badge>
                      </div>
                      {r.note && <p className="text-[hsl(var(--muted-foreground))]">{r.note}</p>}
                      {canManageHr && r.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleDecide(r.id, 'approved')}>Aprobar</Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleDecide(r.id, 'rejected')}>Rechazar</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
