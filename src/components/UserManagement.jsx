import { useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { createUser, getAuthContext } from '../lib/apiClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LoadingSpinner from './LoadingSpinner'
import { UserPlus, Mail, Phone, User, Shield } from 'lucide-react'

const ROLES = ['Empleado', 'Cajero', 'Admin']

const ROLE_BADGE = {
  Superadmin: 'bg-purple-100 text-purple-700',
  Admin:      'bg-blue-100 text-blue-700',
  Empleado:   'bg-green-100 text-green-700',
  Cajero:     'bg-yellow-100 text-yellow-700',
}

function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', role: 'Empleado' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.email.trim()) return setError('El email es requerido')
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    setLoading(true)
    try {
      const { businessId } = await getAuthContext()
      await createUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || null,
        role: form.role,
        business_id: businessId,
      })
      setForm({ email: '', password: '', name: '', phone: '', role: 'Empleado' })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" placeholder="usuario@ejemplo.com" value={form.email} onChange={handleChange} disabled={loading} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña *</Label>
            <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} disabled={loading} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" type="text" placeholder="Nombre completo" value={form.name} onChange={handleChange} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+56912345678" value={form.phone} onChange={handleChange} disabled={loading} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Rol *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Creando...' : 'Crear Usuario'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function UserManagement() {
  const { users, loading, error, refetch } = useUsers()
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Cargando usuarios..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''} en tu negocio</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <UserPlus size={16} />
            Crear Usuario
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <User size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No hay usuarios aún</p>
            <p className="text-sm mt-1">Crea el primer usuario de tu equipo</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contacto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => {
                  const roleLabel = u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1).toLowerCase() : '—'
                  const badgeClass = ROLE_BADGE[roleLabel] || 'bg-gray-100 text-gray-700'
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User size={14} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{u.name || '—'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail size={10} />{u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.phone ? (
                          <span className="flex items-center gap-1"><Phone size={12} />{u.phone}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                          <Shield size={10} />{roleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  )
}
