import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { motion, AnimatePresence } from 'framer-motion'
import { getAuthContext } from '../../lib/apiClient'
import {
  deleteSupplier,
  getLocalById,
  getSupplierKpisByLocal,
  getSuppliersWithMetricsForBusiness,
  patchSupplier,
} from '../../lib/providersApi'
import { useAuth } from '../../context/AuthContext'
import { isInventoryAdminRole } from '../../utils/inventoryAccess'
import { formatCLPDisplay as formatMoneyClp } from '../../lib/formatCLP'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import RegisterSupplierModal from './RegisterSupplierModal'
import SupplierDetailModal from './SupplierDetailModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Users, CheckCircle, DollarSign, Store, Settings2, HelpCircle, X } from 'lucide-react'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CURRENT_YEAR = new Date().getFullYear()

const AVATAR_COLORS = [
  'bg-[hsl(var(--chart-cat-1)/0.15)] text-[hsl(149,60%,28%)]',
  'bg-[hsl(var(--chart-cat-2)/0.15)] text-[hsl(190,70%,26%)]',
  'bg-[hsl(var(--chart-cat-4)/0.15)] text-[hsl(240,45%,38%)]',
  'bg-[hsl(var(--chart-cat-5)/0.15)] text-[hsl(38,80%,28%)]',
  'bg-[hsl(var(--chart-cat-6)/0.15)] text-[hsl(330,55%,32%)]',
  'bg-[hsl(var(--chart-cat-7)/0.15)] text-[hsl(65,55%,24%)]',
]

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const ITEM    = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

function supplierAvatar(name, index) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase()
  const color  = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return { letter, color }
}

function SuppliersKpisDashboard() {
  const { isInventoryAdmin: canAccess, userRole } = useAuth()
  const canEdit = isInventoryAdminRole(userRole)
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [year,  setYear]  = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [suppliersRows,      setSuppliersRows]      = useState([])
  const [suppliersLoading,   setSuppliersLoading]   = useState(true)
  const [suppliersError,     setSuppliersError]     = useState('')
  const [resolvedBusinessId, setResolvedBusinessId] = useState(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [actionRow,    setActionRow]    = useState(null)
  const [rowActionId,  setRowActionId]  = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)

  const load = useCallback(async () => {
    if (!canAccess) { setLoading(false); setData(null); setError(''); return }
    if (!localId)   { setError('No se indicó un local.'); setLoading(false); return }
    setError('')
    setLoading(true)
    try {
      const payload = await getSupplierKpisByLocal(localId, { year, month })
      setData(payload)
    } catch (e) {
      setData(null)
      setError(e?.message || 'No se pudieron cargar los KPIs de proveedores.')
    } finally {
      setLoading(false)
    }
  }, [localId, year, month, canAccess])

  const loadSuppliersList = useCallback(async () => {
    if (!canAccess || !localId) {
      setSuppliersRows([])
      setSuppliersLoading(false)
      setResolvedBusinessId(null)
      return
    }
    setSuppliersError('')
    setSuppliersLoading(true)
    try {
      const [{ businessId: bidFromToken }, loc] = await Promise.all([
        getAuthContext(),
        getLocalById(localId).catch(() => null),
      ])
      const businessId =
        loc?.business_id != null ? String(loc.business_id) :
        bidFromToken != null     ? String(bidFromToken)     : null
      if (!businessId) {
        setSuppliersRows([])
        setSuppliersError('No se pudo determinar el negocio del local.')
        setResolvedBusinessId(null)
        return
      }
      setResolvedBusinessId(businessId)
      const rows = await getSuppliersWithMetricsForBusiness(businessId, { localId })
      setSuppliersRows(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setSuppliersRows([])
      setResolvedBusinessId(null)
      setSuppliersError(e?.message || 'No se pudo cargar el listado de proveedores.')
    } finally {
      setSuppliersLoading(false)
    }
  }, [localId, canAccess])

  const handleToggleActive = useCallback(async (row) => {
    if (!resolvedBusinessId || rowActionId) return
    const newActive = row.is_active === false ? true : false
    setRowActionId(String(row.id))
    setSuppliersRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, is_active: newActive } : r))
    try {
      await patchSupplier(String(row.id), resolvedBusinessId, { is_active: newActive })
      await loadSuppliersList()
    } catch {
      setSuppliersRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, is_active: row.is_active } : r))
    } finally {
      setRowActionId(null)
    }
  }, [resolvedBusinessId, rowActionId, loadSuppliersList])

  const handleDelete = useCallback(async (row) => {
    if (!resolvedBusinessId || rowActionId) return
    setRowActionId(String(row.id))
    try {
      await deleteSupplier(String(row.id), resolvedBusinessId)
      setSuppliersRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)))
      setActionRow(null)
      await load()
    } catch (e) {
      setSuppliersError(e?.message || 'No se pudo eliminar el proveedor.')
    } finally {
      setRowActionId(null)
    }
  }, [resolvedBusinessId, rowActionId, load])

  const availableYears = useMemo(() => {
    let minYear = CURRENT_YEAR
    for (const row of suppliersRows) {
      const raw = row.start_date || row.created_at
      if (!raw) continue
      const y = new Date(raw).getFullYear()
      if (Number.isFinite(y) && y > 1900 && y < minYear) minYear = y
    }
    const years = []
    for (let y = minYear; y <= CURRENT_YEAR; y++) years.push(y)
    return years
  }, [suppliersRows])

  useEffect(() => { load() },             [load])
  useEffect(() => { loadSuppliersList() }, [loadSuppliersList])

  const kpiCards = [
    { icon: Users,       label: 'Total proveedores',    value: data?.total_suppliers ?? '—',              iconColor: 'text-blue-600',                iconBg: 'bg-blue-50',    accent: 'border-l-blue-500'    },
    { icon: CheckCircle, label: 'Proveedores activos',  value: data?.active_suppliers ?? '—',             iconColor: 'text-emerald-600',             iconBg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
    { icon: DollarSign,  label: 'Compras del mes (CLP)', value: formatMoneyClp(data?.month_purchases_clp), iconColor: 'text-[hsl(var(--primary))]',   iconBg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
  ]

  return (
    <>
      <AnimatePresence>
        {guideOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setGuideOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Proveedores</h3>
                </div>
                <button onClick={() => setGuideOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { icon: Store, color: 'text-[hsl(var(--primary))]', title: 'Lista de proveedores', desc: 'Muestra todos los proveedores registrados con sus métricas de compra: total gastado, cantidad de órdenes y costo promedio.' },
                  { icon: DollarSign, color: 'text-emerald-600', title: 'Gasto total', desc: 'Suma acumulada de todas las compras realizadas al proveedor en el período seleccionado (mes y año filtrable).' },
                  { icon: CheckCircle, color: 'text-blue-600', title: 'Órdenes completadas', desc: 'Cantidad de órdenes de compra que ya fueron recibidas y confirmadas para ese proveedor.' },
                  { icon: Users, color: 'text-[hsl(var(--primary))]', title: 'Registrar proveedor', highlight: true, desc: 'Agrega un nuevo proveedor al sistema con su nombre, datos de contacto y categoría de productos.' },
                  { icon: Settings2, color: 'text-slate-600', title: 'Detalle del proveedor', desc: 'Haz clic en cualquier fila para ver el historial completo de órdenes, editar los datos o eliminar el proveedor.' },
                ].map(({ icon: Icon, color, title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={15} /></div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <InventoryShell>
      <div className="px-6 py-6 flex flex-col gap-6 pb-10">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <header className="flex items-center gap-4">
            <span className="flex items-center justify-center w-13 h-13 rounded-xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] p-3">
              <Store size={26} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Proveedores</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Gestiona proveedores y monitorea su impacto en compras
              </p>
              <button
                onClick={() => setGuideOpen(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
              >
                <HelpCircle size={13} />
                <span>¿Cómo funciona esta pantalla?</span>
              </button>
            </div>
          </header>

          {canEdit && (
            <div className="flex items-center gap-3 flex-wrap">
              {resolvedBusinessId && (
                <Button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  disabled={suppliersLoading}
                  className="h-9"
                >
                  Registrar proveedor
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Access error ── */}
        {!canAccess && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            Solo administradores pueden ver los KPIs de proveedores.
          </div>
        )}

        {/* ── KPI error ── */}
        {canAccess && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        {/* ── KPI cards ── */}
        {canAccess && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            variants={STAGGER} initial="hidden" animate="visible"
          >
            {kpiCards.map((k) => (
              <motion.div key={k.label} variants={ITEM}>
                <Card className={`border-l-4 ${k.accent} h-full`}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <span className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${k.iconBg} ${k.iconColor}`}>
                      <k.icon size={24} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-tight">{k.label}</p>
                      {loading
                        ? <div className="h-8 w-16 bg-[hsl(var(--muted))] rounded animate-pulse mt-1" />
                        : <p className={`text-3xl font-bold leading-tight mt-1 ${k.iconColor}`}>{k.value}</p>
                      }
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Suppliers table ── */}
        {canAccess && (
          <Card>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[hsl(var(--border))]">
              <div>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Listado de proveedores</h2>
                {!suppliersLoading && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                    {suppliersRows.length} proveedor{suppliersRows.length !== 1 ? 'es' : ''} registrado{suppliersRows.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {suppliersError && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
                {suppliersError}
              </div>
            )}

            {suppliersLoading ? (
              <div className="py-12">
                <LoadingSpinner message="Cargando proveedores…" />
              </div>
            ) : suppliersRows.length === 0 && !suppliersError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] mb-4">
                  <Store size={26} />
                </span>
                <p className="text-base font-medium text-[hsl(var(--foreground))]">Sin proveedores registrados</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Registra tu primer proveedor con el botón de arriba.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted)/0.5)]">
                      <TableHead className="pl-6 py-3 text-sm font-semibold">Proveedor</TableHead>
                      <TableHead className="py-3 text-sm font-semibold">Estado</TableHead>
                      <TableHead className="text-right py-3 text-sm font-semibold">Uds. en inventario</TableHead>
                      <TableHead className="text-right py-3 text-sm font-semibold">Valor inventario</TableHead>
                      {canEdit && <TableHead className="pr-6 py-3 text-right text-sm font-semibold">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersRows.map((row, idx) => {
                      const inactive = row.is_active === false
                      const isBusy   = rowActionId === String(row.id)
                      const { letter, color } = supplierAvatar(row.name, idx)
                      const avatarCls = inactive ? 'bg-gray-100 text-gray-400' : color

                      return (
                        <TableRow
                          key={row.id}
                          className={`transition-colors ${inactive ? 'bg-[hsl(var(--muted)/0.25)] opacity-60' : 'hover:bg-[hsl(var(--muted)/0.3)]'}`}
                        >
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`flex items-center justify-center w-10 h-10 rounded-full text-base font-bold shrink-0 ${avatarCls}`}>
                                {letter}
                              </span>
                              <span className={`font-semibold text-base ${inactive ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
                                {row.name || '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              className={`text-sm px-3 py-1 ${inactive
                                ? 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-100'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {inactive ? 'Inactivo' : 'Activo'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-base py-4 ${inactive ? 'text-gray-400' : 'text-[hsl(var(--muted-foreground))]'}`}>
                            {row.purchased_products_count ?? 0}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-base font-semibold py-4 ${inactive ? 'text-gray-400' : 'text-[hsl(var(--primary))]'}`}>
                            {formatMoneyClp(row.supplier_purchases_total_clp)}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="pr-6 py-3 text-right">
                              <button
                                type="button"
                                title="Gestionar proveedor"
                                disabled={isBusy}
                                onClick={() => setActionRow(row)}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-40 transition-colors"
                              >
                                <Settings2 size={16} />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {canEdit && (
          <>
            <RegisterSupplierModal
              open={registerOpen}
              onClose={() => setRegisterOpen(false)}
              businessId={resolvedBusinessId}
              localId={localId}
              onSuccess={() => { load(); loadSuppliersList() }}
            />

            <SupplierDetailModal
              open={actionRow != null}
              supplierId={actionRow ? String(actionRow.id) : null}
              businessId={resolvedBusinessId}
              row={actionRow}
              onClose={() => setActionRow(null)}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              rowActionId={rowActionId}
            />
          </>
        )}
      </div>
    </InventoryShell>
    </>
  )
}

export default SuppliersKpisDashboard
