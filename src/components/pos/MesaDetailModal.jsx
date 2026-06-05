import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { apiRequest } from '../../lib/apiClient'
import { formatCLP } from '../../lib/formatCLP'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    <div className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--accent))] transition-colors">
      <div className="min-w-0 flex-1 mr-3">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {item.description && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{item.description}</p>}
        <p className="text-xs font-semibold text-[hsl(var(--primary))] mt-0.5">${formatCLP(item.price || 0)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {qty > 0 && <button onClick={() => onRemove(item.key)}
          className="w-7 h-7 rounded-full border border-[hsl(var(--border))] flex items-center justify-center text-sm font-bold hover:bg-[hsl(var(--accent))] transition-colors">−</button>}
        {qty > 0 && <span className="w-5 text-center text-sm font-bold text-[hsl(var(--primary))]">{qty}</span>}
        <button onClick={() => onAdd(item.key)}
          className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-sm font-bold hover:bg-[hsl(var(--primary))]/90 transition-colors">+</button>
      </div>
    </div>
  )
}

/* ─── acordeón ────────────────────────────────────────────── */
function CategoryAccordion({ label, emoji, items = [], selectedQtys, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const count = items.reduce((s, it) => s + (selectedQtys[it.key] || 0), 0)
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/80 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="text-sm font-semibold">{label}</span>
          {items.length > 0 && <span className="text-xs text-[hsl(var(--muted-foreground))]">({items.length})</span>}
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && <span className="text-xs font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-full">{count} sel.</span>}
          <ChevronIcon open={open} />
        </div>
      </button>
      {open && (
        <div className="divide-y divide-[hsl(var(--border))]">
          {items.length === 0
            ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No dispone de productos</p>
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

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      {/* Header con precio actualizado */}
      <div className="px-4 py-3 bg-[hsl(var(--accent))] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Base ${formatCLP(item.price)}
            {customization.embutido && <span className="text-[hsl(var(--primary))]"> + embutido ${formatCLP(EMBUTIDO_SURCHARGE)}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[hsl(var(--primary))]">${formatCLP(unitPrice)}</p>
          {qty > 1 && <p className="text-xs text-[hsl(var(--muted-foreground))]">×{qty} = ${formatCLP(totalPrice)}</p>}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Embutido */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
              Embutido
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">+${formatCLP(EMBUTIDO_SURCHARGE)} al cambiar</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {EMBUTIDOS.map(e => {
              const available = hasIngredient(e.match)
              const selected  = customization.embutido === e.label
              return (
                <button key={e.id} type="button" disabled={!available} onClick={() => setEmbutido(e.label)}
                  className={[
                    'rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all text-center',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  {e.label}
                  {!available && <span className="block text-[10px] font-normal opacity-70">Sin stock</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Agregados */}
        <div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-2">
            Agregados
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {AGREGADOS.map(a => {
              const available = hasIngredient(a.match)
              const selected  = customization.agregados.includes(a.label)
              return (
                <button key={a.id} type="button" disabled={!available} onClick={() => toggleAgregado(a.label)}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs text-left transition-all flex items-center justify-between gap-1',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-semibold'
                        : 'border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  <span className="truncate">{a.label}</span>
                  <span className={`shrink-0 text-[10px] font-semibold ${selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {!available ? 'Sin stock' : `$${formatCLP(a.price)}`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Resumen de extras seleccionados */}
          {customization.agregados.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex justify-between text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">
                {customization.agregados.length} agregado{customization.agregados.length !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold text-[hsl(var(--primary))]">
                +${formatCLP(customization.agregados.reduce((s, l) => {
                  const a = AGREGADOS.find(ag => ag.label === l)
                  return s + (a?.price || 0)
                }, 0))}
              </span>
            </div>
          )}
        </div>
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
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      {/* Header con precio */}
      <div className="px-4 py-3 bg-[hsl(var(--accent))] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Base ${formatCLP(item.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[hsl(var(--primary))]">${formatCLP(unitPrice)}</p>
          {qty > 1 && <p className="text-xs text-[hsl(var(--muted-foreground))]">×{qty} = ${formatCLP(totalPrice)}</p>}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Proteína — radio exclusivo */}
        <div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-2">
            Proteína
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SANDWICH_PROTEINAS.map(p => {
              const available = hasIngredient(p.match)
              const selected  = customization.embutido === p.label
              return (
                <button key={p.id} type="button" disabled={!available} onClick={() => setProteina(p.label)}
                  className={[
                    'rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all text-center',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  {p.label}
                  {!available && <span className="block text-[10px] font-normal opacity-70">Sin stock</span>}
                </button>
              )
            })}
          </div>
          {!customization.embutido && (
            <p className="text-xs text-amber-600 mt-1.5">Selecciona una proteína para continuar</p>
          )}
        </div>

        {/* Agregados */}
        <div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-2">
            Agregados
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {AGREGADOS.map(a => {
              const available = hasIngredient(a.match)
              const selected  = customization.agregados.includes(a.label)
              return (
                <button key={a.id} type="button" disabled={!available} onClick={() => toggleAgregado(a.label)}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs text-left transition-all flex items-center justify-between gap-1',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-semibold'
                        : 'border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  <span className="truncate">{a.label}</span>
                  <span className={`shrink-0 text-[10px] font-semibold ${selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {!available ? 'Sin stock' : `$${formatCLP(a.price)}`}
                  </span>
                </button>
              )
            })}
          </div>

          {customization.agregados.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex justify-between text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">
                {customization.agregados.length} agregado{customization.agregados.length !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold text-[hsl(var(--primary))]">+${formatCLP(agregadosTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── modal principal ─────────────────────────────────────── */
export default function MesaDetailModal({ mesa, localId, onClose, onTableUpdated }) {
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)

  const [recipes, setRecipes]               = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)

  const [step, setStep]                 = useState('select')   // 'select' | 'customize'
  const [selectedQtys, setSelectedQtys] = useState({})
  const [customizations, setCustomizations] = useState({})     // { itemKey: {embutido, agregados} }

  const [processing, setProcessing] = useState(false)
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')

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
      await apiRequest('/orders', {
        method: 'POST',
        body: { local_id: localId, mesa_id: mesa.id, source: 'dine-in', payment_method: 'CASH', items },
      })
      onTableUpdated?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false) }
  }

  const loading = recipesLoading || menuLoading

  /* ─── PASO 2: personalización ─────────────────────────────── */
  if (step === 'customize') {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
            <DialogTitle className="flex items-center gap-2">
              <button onClick={() => setStep('select')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mr-1">
                ←
              </button>
              <span className="text-base font-semibold">{mesa.name}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] font-normal">Personalización</span>
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}<button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">

            {/* Completos con personalizador */}
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

            {/* Sandwiches */}
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

            {/* Resumen de bebestibles (no personalizables) */}
            {bebestiblesItems.filter(it => (selectedQtys[it.key] || 0) > 0).length > 0 && (
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-2">Bebestibles</p>
                <div className="space-y-1">
                  {bebestiblesItems.filter(it => (selectedQtys[it.key] || 0) > 0).map(it => (
                    <div key={it.key} className="flex justify-between text-sm">
                      <span>{it.name}</span>
                      <span className="font-medium text-[hsl(var(--muted-foreground))]">×{selectedQtys[it.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-4 border-t border-[hsl(var(--border))]">
            <div className="flex items-center justify-between w-full gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep('select')} disabled={processing}>
                ← Volver
              </Button>
              <Button size="sm" onClick={handleConfirmOrder} disabled={processing}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white">
                {processing ? 'Confirmando...' : `Confirmar orden · $${formatCLP(subtotal)}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  /* ─── PASO 1: selección ───────────────────────────────────── */
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-base font-semibold">{mesa.name}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))] font-normal">
              {mesa.zona || 'General'} · {mesa.capacidad} personas
            </span>
          </DialogTitle>
        </DialogHeader>

        {success && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
        )}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {loading ? <Spinner /> : (
            <>
              <CategoryAccordion label="Completos"   emoji="🌭" items={completosItems}   selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
              <CategoryAccordion label="Sandwich"    emoji="🥪" items={sandwichItems}    selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
              <CategoryAccordion label="Bebestibles" emoji="🥤" items={bebestiblesItems} selectedQtys={selectedQtys} onAdd={handleAdd} onRemove={handleRemove} />
            </>
          )}
        </div>

        {totalItems > 0 && (
          <DialogFooter className="px-5 py-4 border-t border-[hsl(var(--border))]">
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
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
