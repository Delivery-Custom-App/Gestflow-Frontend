import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { createOrder } from '../../lib/salesApi'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ─── constantes ──────────────────────────────────────────── */
// Cambio de embutido suma este recargo al precio base
const EMBUTIDO_SURCHARGE = 1500

const EMBUTIDOS = [
  { id: 'churrasco',   label: 'Churrasco',   match: 'churrasco' },
  { id: 'lomito',      label: 'Lomito',       match: 'lomito'    },
  { id: 'champinones', label: 'Champiñones',  match: 'champiñon' },
]

const SANDWICH_PROTEINAS = [
  { id: 'churrasco',   label: 'Churrasco',   match: 'churrasco' },
  { id: 'lomito',      label: 'Lomito',       match: 'lomito'    },
  { id: 'pollo',       label: 'Pollo',        match: 'pollo'     },
  { id: 'hamburguesa', label: 'Hamburguesa',  match: 'hamburgues'},
  { id: 'champinones', label: 'Champiñones',  match: 'champiñon' },
]

const AGREGADOS = [
  { id: 'aji',       label: 'Ají verde',            match: null,              price: 1490 },
  { id: 'cebolla',   label: 'Cebolla frita',         match: 'cebolla',         price: 1490 },
  { id: 'huevos',    label: '2 Huevos fritos',       match: 'huevo',           price: 1490 },
  { id: 'mayo',      label: 'Mayonesa',              match: 'mayo',            price: 1490 },
  { id: 'tomate',    label: 'Tomate',                match: 'tomate',          price: 1490 },
  { id: 'palta',     label: 'Palta',                 match: 'palta',           price: 2990 },
  { id: 'tocino',    label: 'Tocino salteado',       match: 'tocino',          price: 2990 },
  { id: 'jamon',     label: 'Jamón salteado',        match: 'jamon',           price: 2990 },
  { id: 'pimenton',  label: 'Pimentón salteado',     match: 'pimenton',        price: 1490 },
  { id: 'champinon', label: 'Champiñón salteado',    match: 'champiñon',       price: 1490 },
  { id: 'queso',     label: 'Queso caliente',        match: 'queso',           price: 2990 },
  { id: 'chucrut',   label: 'Chucrut',               match: 'chucrut',         price: 1490 },
  { id: 'salsa_am',  label: 'Salsa americana',       match: 'salsa americana', price: 1490 },
  { id: 'choclo',    label: 'Choclo desgranado',     match: 'choclo',          price: 1490 },
  { id: 'poroto',    label: 'Poroto Verde',           match: null,              price: 1490 },
]

/** Calcula el precio total de un item con sus customizaciones */
function calcItemPrice(basePrice, customization) {
  if (!customization) return basePrice
  const embutidoExtra = customization.embutido ? EMBUTIDO_SURCHARGE : 0
  const agregadosExtra = (customization.agregados || []).reduce((sum, label) => {
    const a = AGREGADOS.find(ag => ag.label === label)
    return sum + (a?.price || 0)
  }, 0)
  return basePrice + embutidoExtra + agregadosExtra
}

/* ─── helpers ─────────────────────────────────────────────── */
const Spinner = () => (
  <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
    <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs">Cargando...</p>
  </div>
)
const ChevronIcon = ({ open }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

function norm(s = '') {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function findCat(cats, kw) {
  return cats.find(c => norm(c.name).includes(norm(kw))) ?? null
}
function recipeKey(id)  { return `r:${id}` }
function productKey(id) { return `p:${id}` }

function isCompleto(item) { return item.type === 'recipe' && norm(item.categoryName || '').includes('completo') }

/* ─── fila de item ────────────────────────────────────────── */
function ItemRow({ item, qty, onAdd, onRemove }) {
  return (
    <div
      className={cn(
        'group flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all',
        qty > 0
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 shadow-sm'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--accent))]'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold leading-tight text-[hsl(var(--foreground))] line-clamp-2">{item.name}</p>
        {item.description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">{item.description}</p>}
        <p className="mt-2 text-lg font-black text-[hsl(var(--primary))]">${formatCLP(item.price || 0)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {qty > 0 && <button onClick={(event) => { event.stopPropagation(); onRemove(item.key) }}
          className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-2xl font-black shadow-sm transition-colors hover:bg-[hsl(var(--accent))]">−</button>}
        {qty > 0 && <span className="min-w-8 text-center text-xl font-black text-[hsl(var(--primary))]">{qty}</span>}
        <button onClick={(event) => { event.stopPropagation(); onAdd(item.key) }}
          className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-[hsl(var(--primary))] text-2xl font-black text-white shadow-md transition-colors hover:bg-[hsl(var(--primary))]/90">+</button>
      </div>
    </div>
  )
}

/* ─── acordeón ────────────────────────────────────────────── */
function CategoryAccordion({ label, items = [], selectedQtys, onAdd, onRemove }) {
  const [open, setOpen] = useState(true)
  const count = items.reduce((s, it) => s + (selectedQtys[it.key] || 0), 0)
  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm">
      <button onClick={() => setOpen(o => !o)}
        className="flex min-h-[58px] w-full items-center justify-between bg-[hsl(var(--accent))] px-4 py-3 transition-colors hover:bg-[hsl(var(--accent))]/80">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-sm font-black text-[hsl(var(--primary))] shadow-sm">
            {label.slice(0, 2).toUpperCase()}
          </span>
          <div className="text-left">
            <p className="text-base font-black leading-tight">{label}</p>
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{items.length} productos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && <span className="rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-sm font-black text-white">{count}</span>}
          <ChevronIcon open={open} />
        </div>
      </button>
      {open && (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.length === 0
            ? <p className="col-span-full py-5 text-center text-sm text-[hsl(var(--muted-foreground))]">No dispone de productos</p>
            : items.map(it => <ItemRow key={it.key} item={it} qty={selectedQtys[it.key] || 0} onAdd={onAdd} onRemove={onRemove} />)
          }
        </div>
      )}
    </div>
  )
}

/* ─── paso 2: personalizador de completo ──────────────────── */
function CompleteCustomizer({ item, qty, customization, onChange, availableProducts }) {

  function hasIngredient(matchKeyword) {
    if (!matchKeyword) return true
    const n = norm(matchKeyword)
    return availableProducts.some(p => norm(p.name).includes(n) || n.includes(norm(p.name)))
  }

  const setEmbutido = (val) =>
    onChange({ ...customization, embutido: customization.embutido === val ? null : val })

  const toggleAgregado = (label) =>
    onChange({
      ...customization,
      agregados: customization.agregados.includes(label)
        ? customization.agregados.filter(a => a !== label)
        : [...customization.agregados, label],
    })

  const unitPrice = calcItemPrice(item.price, customization)
  const totalPrice = unitPrice * qty
  const agregadosTotal = (customization.agregados || []).reduce((s, l) => {
    const a = AGREGADOS.find(ag => ag.label === l)
    return s + (a?.price || 0)
  }, 0)

  return (
    <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--primary))]/12 via-[hsl(var(--accent))] to-[hsl(var(--card))] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[hsl(var(--primary))]">Completo</p>
          <p className="mt-1 text-lg font-black leading-tight text-[hsl(var(--foreground))]">{item.name}</p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Base ${formatCLP(item.price)} · cantidad {qty}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(var(--card))]/90 px-4 py-3 text-right shadow-sm ring-1 ring-[hsl(var(--border))]">
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Unitario</p>
          <p className="text-2xl font-black text-[hsl(var(--primary))]">${formatCLP(unitPrice)}</p>
          {qty > 1 && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Total ${formatCLP(totalPrice)}</p>}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[0.9fr_1.4fr]">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3">
            <p className="text-sm font-black text-[hsl(var(--foreground))]">Cambio de embutido</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Opcional · +${formatCLP(EMBUTIDO_SURCHARGE)}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {EMBUTIDOS.map(e => {
              const available = hasIngredient(e.match)
              const selected  = customization.embutido === e.label
              return (
                <button key={e.id} type="button" disabled={!available} onClick={() => setEmbutido(e.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-4 py-3 text-sm font-black transition-all text-left',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-md'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  {e.label}
                  {!available && <span className="block text-[10px] font-normal opacity-70">Sin stock</span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[hsl(var(--foreground))]">Agregados</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Toca para sumar o quitar extras.</p>
            </div>
            {customization.agregados.length > 0 && <span className="rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-xs font-black text-[hsl(var(--primary))]">+${formatCLP(agregadosTotal)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {AGREGADOS.map(a => {
              const available = hasIngredient(a.match)
              const selected  = customization.agregados.includes(a.label)
              return (
                <button key={a.id} type="button" disabled={!available} onClick={() => toggleAgregado(a.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-3 py-2 text-left transition-all flex flex-col justify-center gap-1',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  <span className="truncate text-sm font-black">{a.label}</span>
                  <span className={`text-xs font-bold ${selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {!available ? 'Sin stock' : `$${formatCLP(a.price)}`}
                  </span>
                </button>
              )
            })}
          </div>

        </section>
      </div>
    </div>
  )
}

/* ─── paso 2: personalizador de sandwich ──────────────────── */
function SandwichCustomizer({ item, qty, customization, onChange, availableProducts }) {

  function hasIngredient(matchKeyword) {
    if (!matchKeyword) return true
    const n = norm(matchKeyword)
    return availableProducts.some(p => norm(p.name).includes(n) || n.includes(norm(p.name)))
  }

  const setProteina = (val) =>
    onChange({ ...customization, embutido: customization.embutido === val ? null : val })

  const toggleAgregado = (label) =>
    onChange({
      ...customization,
      agregados: customization.agregados.includes(label)
        ? customization.agregados.filter(a => a !== label)
        : [...customization.agregados, label],
    })

  const unitPrice  = calcItemPrice(item.price, customization)
  const totalPrice = unitPrice * qty

  const agregadosTotal = (customization.agregados || []).reduce((s, l) => {
    const a = AGREGADOS.find(ag => ag.label === l)
    return s + (a?.price || 0)
  }, 0)

  return (
    <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--primary))]/12 via-[hsl(var(--accent))] to-[hsl(var(--card))] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[hsl(var(--primary))]">Sandwich</p>
          <p className="mt-1 text-lg font-black leading-tight text-[hsl(var(--foreground))]">{item.name}</p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Base ${formatCLP(item.price)} · cantidad {qty}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(var(--card))]/90 px-4 py-3 text-right shadow-sm ring-1 ring-[hsl(var(--border))]">
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Unitario</p>
          <p className="text-2xl font-black text-[hsl(var(--primary))]">${formatCLP(unitPrice)}</p>
          {qty > 1 && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Total ${formatCLP(totalPrice)}</p>}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[0.9fr_1.4fr]">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3">
            <p className="text-sm font-black text-[hsl(var(--foreground))]">Proteína</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Selecciona una para continuar.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {SANDWICH_PROTEINAS.map(p => {
              const available = hasIngredient(p.match)
              const selected  = customization.embutido === p.label
              return (
                <button key={p.id} type="button" disabled={!available} onClick={() => setProteina(p.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-4 py-3 text-sm font-black transition-all text-left',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-md'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  {p.label}
                  {!available && <span className="block text-[10px] font-normal opacity-70">Sin stock</span>}
                </button>
              )
            })}
          </div>
          {!customization.embutido && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Selecciona una proteína para continuar</p>
          )}
        </section>

        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[hsl(var(--foreground))]">Agregados</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Toca para sumar o quitar extras.</p>
            </div>
            {customization.agregados.length > 0 && <span className="rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-xs font-black text-[hsl(var(--primary))]">+${formatCLP(agregadosTotal)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {AGREGADOS.map(a => {
              const available = hasIngredient(a.match)
              const selected  = customization.agregados.includes(a.label)
              return (
                <button key={a.id} type="button" disabled={!available} onClick={() => toggleAgregado(a.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-3 py-2 text-left transition-all flex flex-col justify-center gap-1',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  <span className="truncate text-sm font-black">{a.label}</span>
                  <span className={`text-xs font-bold ${selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {!available ? 'Sin stock' : `$${formatCLP(a.price)}`}
                  </span>
                </button>
              )
            })}
          </div>

        </section>
      </div>
    </div>
  )
}

/* ─── modal principal ─────────────────────────────────────── */
export default function MesaDetailModal({ mesa, localId, cajaId, onClose, onTableUpdated }) {
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)

  const [recipes, setRecipes]               = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)

  const [step, setStep]                 = useState('select')   // 'select' | 'customize'
  const [selectedQtys, setSelectedQtys] = useState({})
  const [customizations, setCustomizations] = useState({})     // { itemKey: {embutido, agregados} }

  const [processing, setProcessing] = useState(false)
  const [error, setError]           = useState('')

  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  /* cargas iniciales */
  useEffect(() => {
    if (!localId) return
    setRecipesLoading(true)
    apiRequest(`/recipes?local_id=${localId}&is_active=true`)
      .then(d => setRecipes(Array.isArray(d) ? d : []))
      .catch(() => setRecipes([]))
      .finally(() => setRecipesLoading(false))
  }, [localId])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  /* lista plana de todos los productos del menú (para check de disponibilidad) */
  const allMenuProducts = useMemo(() =>
    (menuData?.categories ?? []).flatMap(c => c.products || []),
    [menuData]
  )

  /* items estructurados para la UI */
  const completosItems = useMemo(() =>
    recipes
      .filter(r => norm(r.category_name || '').includes('completo'))
      .map(r => ({ key: recipeKey(r.id), id: r.id, type: 'recipe', categoryName: r.category_name || '', name: r.name, description: r.description || '', price: r.price_sale || 0 })),
    [recipes]
  )
  const sandwichItems = useMemo(() =>
    recipes
      .filter(r => norm(r.category_name || '').includes('sandwich'))
      .map(r => ({ key: recipeKey(r.id), id: r.id, type: 'recipe', categoryName: r.category_name || '', name: r.name, description: r.description || '', price: r.price_sale || 0 })),
    [recipes]
  )
  const bebestiblesItems = useMemo(() => {
    const cat = findCat(menuData?.categories ?? [], 'bebestible')
    return (cat?.products ?? []).map(p => ({ key: productKey(p.id), id: p.id, type: 'product', categoryName: 'Bebestibles', name: p.name, description: p.description || '', price: p.price || 0 }))
  }, [menuData])

  const allItems = useMemo(() => [...completosItems, ...sandwichItems, ...bebestiblesItems], [completosItems, sandwichItems, bebestiblesItems])

  /* totales — incluye precio de extras si estamos en paso customize */
  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)
  const subtotal   = Object.entries(selectedQtys).reduce((s, [key, qty]) => {
    const it   = allItems.find(i => i.key === key)
    const cust = step === 'customize' ? customizations[key] : null
    return s + calcItemPrice(it?.price || 0, cust) * qty
  }, 0)

  /* items de completo/sandwich seleccionados (requieren personalización) */
  const menuItemsSelected = useMemo(() =>
    allItems.filter(it => (isCompleto(it) || it.type === 'recipe') && (selectedQtys[it.key] || 0) > 0),
    [allItems, selectedQtys]
  )

  const handleAdd = useCallback((key) => {
    setSelectedQtys(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [])
  const handleRemove = useCallback((key) => {
    setSelectedQtys(prev => {
      const next = { ...prev }
      if ((next[key] || 0) <= 1) delete next[key]
      else next[key]--
      return next
    })
  }, [])

  /* ir a paso de personalización */
  const handleContinuar = () => {
    // Inicializar customizations para cada item de receta seleccionado
    const init = {}
    menuItemsSelected.forEach(it => {
      init[it.key] = customizations[it.key] || { embutido: null, agregados: [] }
    })
    setCustomizations(init)
    setStep('customize')
  }

  /* crear la orden */
  const handleConfirmOrder = async () => {
    if (!totalItems) { setError('Selecciona al menos un producto'); return }
    // Validar que sandwiches tengan proteína seleccionada
    const sandwichSinProteina = menuItemsSelected
      .filter(it => !isCompleto(it))
      .find(it => !(customizations[it.key]?.embutido))
    if (sandwichSinProteina) {
      setError(`Selecciona una proteína para "${sandwichSinProteina.name}"`)
      return
    }
    setProcessing(true); setError('')
    try {
      const items = Object.entries(selectedQtys).map(([key, quantity]) => {
        const it   = allItems.find(i => i.key === key)
        const cust = customizations[key]
        let itemName = it?.name || 'Producto'
        if (cust?.embutido)           itemName += ` [${cust.embutido}]`
        if (cust?.agregados?.length)  itemName += ` + ${cust.agregados.join(', ')}`
        const unitPrice = Math.round(calcItemPrice(it?.price || 0, cust))
        const base = { item_name: itemName, quantity, unit_price: unitPrice }
        return it?.type === 'recipe' ? { ...base, recipe_id: it.id } : { ...base, product_id: it.id }
      })
      await createOrder({
        local_id: localId,
        mesa_id: mesa.id,
        caja_id: cajaId || null,
        source: 'dine_in',
        items,
      })
      onTableUpdated?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false) }
  }

  const loading = recipesLoading || menuLoading

  /* ─── un solo return para ambos pasos — evita doble slide ─── */
  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={handleClose}
      />
      <div className={cn('absolute inset-y-0 right-0 w-full md:max-w-3xl xl:max-w-4xl flex flex-col shadow-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] overflow-hidden transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-2">
            {step === 'customize' && (
              <button onClick={() => setStep('select')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mr-1">←</button>
            )}
            <span className="text-base font-semibold text-[hsl(var(--foreground))]">{mesa.name}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))] font-normal">
              {step === 'customize' ? 'Personalización' : `${mesa.zona || 'General'} · ${mesa.capacidad} personas`}
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* ── Contenido según step ── */}
        {step === 'select' ? (
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-5 py-4 space-y-3">
            {loading ? <Spinner /> : (
              <>
                <CategoryAccordion label="Completos"   items={completosItems}   selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
                <CategoryAccordion label="Sandwich"    items={sandwichItems}    selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
                <CategoryAccordion label="Bebestibles" items={bebestiblesItems} selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-5 py-5 space-y-5">
            {menuItemsSelected.filter(isCompleto).map(it => (
              <CompleteCustomizer
                key={it.key}
                item={it}
                qty={selectedQtys[it.key] || 0}
                customization={customizations[it.key] || { embutido: null, agregados: [] }}
                onChange={(val) => setCustomizations(prev => ({ ...prev, [it.key]: val }))}
                availableProducts={allMenuProducts}
              />
            ))}
            {menuItemsSelected.filter(it => !isCompleto(it)).map(it => (
              <SandwichCustomizer
                key={it.key}
                item={it}
                qty={selectedQtys[it.key] || 0}
                customization={customizations[it.key] || { embutido: null, agregados: [] }}
                onChange={(val) => setCustomizations(prev => ({ ...prev, [it.key]: val }))}
                availableProducts={allMenuProducts}
              />
            ))}
            {bebestiblesItems.filter(it => (selectedQtys[it.key] || 0) > 0).length > 0 && (
              <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-sm">
                <p className="text-sm font-black text-[hsl(var(--foreground))]">Bebestibles seleccionados</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {bebestiblesItems.filter(it => (selectedQtys[it.key] || 0) > 0).map(it => (
                    <div key={it.key} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm">
                      <span className="font-bold">{it.name}</span>
                      <span className="rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 font-black text-[hsl(var(--primary))]">×{selectedQtys[it.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer según step ── */}
        {step === 'select' ? (
          totalItems > 0 && (
            <div className="px-5 py-4 border-t border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center justify-between w-full gap-3">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {totalItems} ítem{totalItems !== 1 ? 's' : ''} ·{' '}
                  <span className="font-bold text-[hsl(var(--primary))]">${formatCLP(subtotal)}</span>
                </span>
                <Button size="sm" onClick={handleContinuar}
                  className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white">
                  Continuar →
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="px-5 py-4 border-t border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center justify-between w-full gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep('select')} disabled={processing}>
                ← Volver
              </Button>
              <Button size="sm" onClick={handleConfirmOrder} disabled={processing}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white">
                {processing ? 'Confirmando...' : `Confirmar orden · $${formatCLP(subtotal)}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
