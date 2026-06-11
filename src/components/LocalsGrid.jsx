import { useState } from 'react'
import { Building2, MapPin, Plus, TrendingUp, Settings, ChevronDown, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OpcionesDrawer from './OpcionesDrawer'
import FranchisesMap from './FranchisesMap'

const THRESHOLDS_KEY = 'sibagestion_flow_thresholds'
const DEFAULT_THRESHOLDS = { medium: 20, high: 50, salesDays: 1 }

function loadThresholds() {
  try {
    const stored = localStorage.getItem(THRESHOLDS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed.medium === 'number' && typeof parsed.high === 'number') {
        return { ...DEFAULT_THRESHOLDS, ...parsed }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_THRESHOLDS
}

function getSalesFlow(count, thresholds) {
  if (count === undefined || count === null) return null
  if (count >= thresholds.high)
    return { label: 'Alto flujo', dotColor: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  if (count >= thresholds.medium)
    return { label: 'Flujo medio', dotColor: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
  return { label: 'Flujo bajo', dotColor: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' }
}

function DeltaBadge({ delta }) {
  if (!delta || (delta.current === 0 && delta.prev === 0)) return null
  const d = delta.delta
  if (d > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
      <ArrowUp className="h-3 w-3 shrink-0" />+{d} vs 1h ant.
    </span>
  )
  if (d < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <ArrowDown className="h-3 w-3 shrink-0" />{d} vs 1h ant.
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-full px-2.5 py-1">
      <Minus className="h-3 w-3 shrink-0" />Estable
    </span>
  )
}

function LocalCard({ local, onSelect, salesCount, thresholds, delta }) {
  const initials = local.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const flow = getSalesFlow(salesCount, thresholds)

  return (
    <div
      onClick={() => onSelect(local)}
      className="group relative w-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
    >
      {/* Header */}
      <div className="relative px-6 py-6 overflow-hidden bg-[hsl(var(--primary))]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full border-[20px] border-white" />
          <div className="absolute -right-2 -bottom-10 h-24 w-24 rounded-full border-[16px] border-white" />
        </div>

        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--card))]/20 backdrop-blur-sm border border-white/30">
            <span className="text-lg font-black text-white tracking-tight">{initials}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-white text-lg leading-tight truncate">{local.name}</h3>
            {local.address ? (
              <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-white/70 shrink-0" />
                <p className="text-xs text-white/75 truncate">{local.address}</p>
              </div>
            ) : (
              <p className="text-xs text-white/50 mt-1">Sin dirección registrada</p>
            )}
          </div>
        </div>
      </div>

      {/* Sales indicator + delta */}
      {flow && (
        <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center flex-wrap gap-2">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${flow.bg} ${flow.text} ${flow.border}`}>
            <span className={`h-2 w-2 rounded-full shrink-0 ${flow.dotColor} animate-pulse`} />
            <TrendingUp className="h-3 w-3 shrink-0" />
            {salesCount} ventas · {flow.label}
          </div>
          <DeltaBadge delta={delta} />
        </div>
      )}
    </div>
  )
}

// ── Accordion section for one group of locals ───────────────
function LocalsAccordion({ title, count, items, onLocalSelect, salesCounts, deltaCounts, thresholds, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
      {/* Bar / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)]">
            <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <span className="font-bold text-[hsl(var(--foreground))]">{title}</span>
          <span className="inline-flex items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-xs font-bold px-2.5 py-0.5 min-w-[1.5rem]">
            {count}
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-[hsl(var(--muted-foreground))] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible content */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((local) => (
                <LocalCard
                  key={local.id}
                  local={local}
                  onSelect={onLocalSelect}
                  salesCount={salesCounts[local.id]}
                  thresholds={thresholds}
                  delta={deltaCounts?.[local.id]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main grid ────────────────────────────────────────────────
function LocalsGrid({ locales, onLocalSelect, onCreateLocal, salesCounts = {}, deltaCounts = {}, isSuperAdmin = false, onRefresh }) {
  const [thresholds,    setThresholds]    = useState(loadThresholds)
  const [showOpciones,  setShowOpciones]  = useState(false)

  const handleSaveThresholds = (newThresholds) => {
    setThresholds({ ...DEFAULT_THRESHOLDS, ...newThresholds })
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify({ ...DEFAULT_THRESHOLDS, ...newThresholds }))
    // Trigger a refresh so the new salesDays takes effect immediately
    onRefresh?.()
  }

  const hasCategories = locales.some((l) => l.category)

  const grouped = locales.reduce((acc, local) => {
    const key = local.category || '__sin_categoria__'
    if (!acc[key]) acc[key] = []
    acc[key].push(local)
    return acc
  }, {})

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === '__sin_categoria__') return 1
    if (b === '__sin_categoria__') return -1
    return a.localeCompare(b)
  })

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
                SibaGestión
              </div>
              <h1 className="text-3xl font-black text-[hsl(var(--foreground))] tracking-tight">
                Tus Franquicias
              </h1>
              <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))] max-w-md">
                {locales.length > 0
                  ? `${locales.length} franquicia${locales.length !== 1 ? 's' : ''} registrada${locales.length !== 1 ? 's' : ''}. Período: ${thresholds.salesDays} día${thresholds.salesDays !== 1 ? 's' : ''}.`
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

        {/* Accordions */}
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
          ) : hasCategories ? (
            sortedGroups.map(([category, items]) => (
              <LocalsAccordion
                key={category}
                title={category === '__sin_categoria__' ? 'Sin categoría' : category}
                count={items.length}
                items={items}
                onLocalSelect={onLocalSelect}
                salesCounts={salesCounts}
                deltaCounts={deltaCounts}
                thresholds={thresholds}
                defaultOpen
              />
            ))
          ) : (
            <LocalsAccordion
              title="Todas las franquicias"
              count={locales.length}
              items={locales}
              onLocalSelect={onLocalSelect}
              salesCounts={salesCounts}
              deltaCounts={deltaCounts}
              thresholds={thresholds}
              defaultOpen
            />
          )}
        </div>

        {/* Map — always shown below franchises */}
        {locales.length > 0 && (
          <div className="px-16 pb-12">
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
