import { useMemo, useState } from 'react'
import { Building2, MapPin, Plus, TrendingUp, TrendingDown, Settings, Search, ArrowUp, ArrowDown, Minus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import OpcionesDrawer from './OpcionesDrawer'
import FranchisesMap from './FranchisesMap'

const THRESHOLDS_KEY = 'gestflow_flow_thresholds'
const DEFAULT_THRESHOLDS = { medium: 20, high: 50, salesDays: 7 }

function loadThresholds() {
  try {
    const stored = localStorage.getItem(THRESHOLDS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed.medium === 'number' && typeof parsed.high === 'number') {
        return { ...DEFAULT_THRESHOLDS, ...parsed }
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_THRESHOLDS
}

const TIER_ORDER = { 'Bajo': 0, 'Medio': 1, 'Alto': 2 }

function getSalesFlow(count, thresholds) {
  if (count === undefined || count === null) return null
  if (count >= thresholds.high)
    return { label: 'Alto',  dotColor: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' }
  if (count >= thresholds.medium)
    return { label: 'Medio', dotColor: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
  return   { label: 'Bajo',  dotColor: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' }
}

// Compara tier actual vs tier hace 1h. Retorna 'up' | 'down' | null
function getFlowTrend(currentCount, delta, thresholds) {
  if (!delta || currentCount == null) return null
  const prevCount = currentCount - delta.current + delta.prev
  const currFlow = getSalesFlow(currentCount, thresholds)
  const prevFlow = getSalesFlow(prevCount, thresholds)
  if (!currFlow || !prevFlow || currFlow.label === prevFlow.label) return null
  return TIER_ORDER[currFlow.label] > TIER_ORDER[prevFlow.label] ? 'up' : 'down'
}

function DeltaBadge({ delta }) {
  if (!delta || (delta.current === 0 && delta.prev === 0)) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
  const d = delta.delta
  if (d > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <ArrowUp className="h-3 w-3" />+{d}
    </span>
  )
  if (d < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
      <ArrowDown className="h-3 w-3" />{d}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
      <Minus className="h-3 w-3" />Estable
    </span>
  )
}

function LocalsGrid({ locales, onLocalSelect, onCreateLocal, salesCounts = {}, deltaCounts = {}, isSuperAdmin = false, onRefresh }) {
  const [thresholds,   setThresholds]   = useState(loadThresholds)
  const [showOpciones, setShowOpciones] = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterZona,   setFilterZona]   = useState('')
  const [filterFlow,   setFilterFlow]   = useState('')

  const handleSaveThresholds = (newThresholds) => {
    setThresholds({ ...DEFAULT_THRESHOLDS, ...newThresholds })
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify({ ...DEFAULT_THRESHOLDS, ...newThresholds }))
    onRefresh?.()
  }

  const zonas = useMemo(() => {
    const set = new Set(locales.map((l) => l.category || '').filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [locales])

  const rows = useMemo(() => {
    return locales.filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterZona) {
        const zona = l.category || ''
        if (filterZona === '__sin__' ? zona !== '' : zona !== filterZona) return false
      }
      if (filterFlow) {
        const flow = getSalesFlow(salesCounts[l.id], thresholds)
        if (!flow || flow.label !== filterFlow) return false
      }
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [locales, search, filterZona, filterFlow, salesCounts, thresholds])

  const activeFilters = search || filterZona || filterFlow

  return (
    <>
      <div className="min-h-full bg-[hsl(var(--background))]">
        {/* Page header */}
        <div
          data-onboarding="locales-grid"
          className="px-6 py-8 sm:py-10"
          style={{ background: 'linear-gradient(160deg, hsl(var(--primary)/0.06) 0%, hsl(var(--background)) 70%)' }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))] mb-3">
                <Building2 className="h-3.5 w-3.5" />
                Gestflow
              </div>
              <h1 className="text-3xl font-black text-[hsl(var(--foreground))] tracking-tight">
                Tus Franquicias
              </h1>
              <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))] max-w-md">
                {locales.length > 0
                  ? `${locales.length} franquicia${locales.length !== 1 ? 's' : ''} · Período: últimas 24 horas`
                  : 'Crea tu primera franquicia para comenzar a operar.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowOpciones(true)} className="gap-2 rounded-xl">
                <Settings className="h-4 w-4" />
                Opciones
              </Button>
              <Button onClick={onCreateLocal} className="gap-2 rounded-xl px-5">
                <Plus className="h-4 w-4" />
                Crear Franquicia
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {locales.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-24 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.08)]">
                <Building2 className="h-10 w-10 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[hsl(var(--foreground))]">No hay franquicias disponibles</h3>
              <p className="mb-8 text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
                Agrega tu primera franquicia para empezar a gestionar tu negocio.
              </p>
              <Button onClick={onCreateLocal} className="gap-2 rounded-xl px-6">
                <Plus className="h-4 w-4" />
                Crear primera franquicia
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm bg-[hsl(var(--card))]">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="text"
                    placeholder="Buscar franquicia…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary))]"
                  />
                </div>
                {zonas.length > 0 && (
                  <select
                    value={filterZona}
                    onChange={(e) => setFilterZona(e.target.value)}
                    className="py-1.5 px-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                  >
                    <option value="">Todas las zonas</option>
                    {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
                    <option value="__sin__">Sin zona</option>
                  </select>
                )}
                <select
                  value={filterFlow}
                  onChange={(e) => setFilterFlow(e.target.value)}
                  className="py-1.5 px-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                >
                  <option value="">Todos los flujos</option>
                  <option value="Alto">Alto flujo</option>
                  <option value="Medio">Flujo medio</option>
                  <option value="Bajo">Flujo bajo</option>
                </select>
                {activeFilters && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setFilterZona(''); setFilterFlow('') }}
                    className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
                  >
                    Limpiar filtros
                  </button>
                )}
                <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                  {rows.length} de {locales.length}
                </span>
              </div>

              {/* Table */}
              {rows.length === 0 ? (
                <div className="py-16 flex flex-col items-center text-center text-[hsl(var(--muted-foreground))]">
                  <Building2 className="h-8 w-8 mb-3 opacity-40" />
                  <p className="text-sm">Sin resultados para los filtros actuales.</p>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setFilterZona(''); setFilterFlow('') }}
                    className="mt-2 text-xs text-[hsl(var(--primary))] underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[hsl(var(--muted)/0.4)] hover:bg-[hsl(var(--muted)/0.4)]">
                        <TableHead className="pl-5 py-3 text-xs font-semibold uppercase tracking-wide">Franquicia</TableHead>
                        <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide">Zona</TableHead>
                        <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide">Dirección</TableHead>
                        <TableHead className="text-center py-3 text-xs font-semibold uppercase tracking-wide">Flujo</TableHead>
                        <TableHead className="text-right py-3 text-xs font-semibold uppercase tracking-wide">Ventas</TableHead>
                        <TableHead className="text-right py-3 text-xs font-semibold uppercase tracking-wide">Δ 1h</TableHead>
                        <TableHead className="pr-5 py-3 w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((local) => {
                        const initials  = local.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                        const flow      = getSalesFlow(salesCounts[local.id], thresholds)
                        const delta     = deltaCounts?.[local.id]
                        const flowTrend = getFlowTrend(salesCounts[local.id], delta, thresholds)
                        return (
                          <TableRow
                            key={local.id}
                            onClick={() => onLocalSelect(local)}
                            className="cursor-pointer hover:bg-[hsl(var(--muted)/0.35)] transition-colors"
                          >
                            <TableCell className="pl-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-black">
                                  {initials}
                                </span>
                                <span className="font-semibold text-sm text-[hsl(var(--foreground))]">{local.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                {local.category || <span className="italic opacity-50">Sin zona</span>}
                              </span>
                            </TableCell>
                            <TableCell className="py-3.5 max-w-[200px]">
                              {local.address ? (
                                <div className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] min-w-0">
                                  <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                                  <span className="truncate">{local.address}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-[hsl(var(--muted-foreground))] italic opacity-50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 text-center">
                              {flow ? (
                                <span
                                  title={flowTrend === 'up' ? 'Subió de tier en la última hora' : flowTrend === 'down' ? 'Bajó de tier en la última hora' : undefined}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${flow.bg} ${flow.text} ${flow.border}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${flow.dotColor}`} />
                                  {flow.label}
                                  {flowTrend === 'up'   && <TrendingUp   className="h-3 w-3 ml-0.5 shrink-0 text-emerald-500" />}
                                  {flowTrend === 'down' && <TrendingDown className="h-3 w-3 ml-0.5 shrink-0 text-red-500" />}
                                </span>
                              ) : (
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 text-right tabular-nums">
                              {salesCounts[local.id] != null ? (
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                                  <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                                  {salesCounts[local.id]}
                                </span>
                              ) : (
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 text-right">
                              <DeltaBadge delta={delta} />
                            </TableCell>
                            <TableCell className="pr-5 py-3.5 text-right">
                              <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] inline-block" />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Map — always shown below */}
          {locales.length > 0 && (
            <div className="px-10 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
                  Ubicación de franquicias
                </h2>
                <div className="flex-1 h-px bg-[hsl(var(--border))]" />
              </div>
              <FranchisesMap locales={locales} />
            </div>
          )}
        </div>
      </div>

      <OpcionesDrawer
        isOpen={showOpciones}
        onClose={() => setShowOpciones(false)}
        locales={locales}
        thresholds={thresholds}
        onSaveThresholds={handleSaveThresholds}
        isSuperAdmin={isSuperAdmin}
        onDeleteDone={() => { setShowOpciones(false); onRefresh?.() }}
      />
    </>
  )
}

export default LocalsGrid
