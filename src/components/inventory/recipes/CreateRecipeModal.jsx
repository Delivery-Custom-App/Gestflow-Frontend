import { useState, useEffect, useRef } from 'react'
import { getInventoryProductsPage, getCategoriesForLocal, postCategory } from '../../../lib/inventoryApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'
import { formatCLPDisplay as fmt } from '../../../lib/formatCLP'

const UNITS = [
  { value: 'unidad',      label: 'Unidad'      },
  { value: 'kg',          label: 'KG'          },
  { value: 'g',           label: 'G'           },
  { value: 'L',           label: 'L'           },
  { value: 'ml',          label: 'ML'          },
  { value: 'taza',        label: 'TAZA'        },
  { value: 'cucharada',   label: 'CUCHARADA'   },
  { value: 'cucharadita', label: 'CUCHARADITA' },
]

// Únicamente estas 2 categorías disponibles para el menú
const MENU_CATEGORIES = ['Completos', 'Sandwich']

function titleCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/** Selector de categoría — solo clic, despliega Completos / Sandwich. */
function MenuCategoryInput({ localId, selectedName, onResolve, disabled, error }) {
  const [open, setOpen]           = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveErr, setResolveErr] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const resolveCategory = async (name) => {
    if (!localId) return
    setResolving(true)
    setResolveErr('')
    setOpen(false)
    try {
      const existing = await getCategoriesForLocal(localId)
      const found = (Array.isArray(existing) ? existing : [])
        .find(c => c.name.toLowerCase() === name.toLowerCase())
      if (found) {
        onResolve(found.id, found.name)
      } else {
        const created = await postCategory({ local_id: localId, name, is_active: true })
        onResolve(created.id, created.name)
      }
    } catch (err) {
      setResolveErr(err?.message || 'Error al guardar la categoría')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled || resolving}
        onClick={() => setOpen(o => !o)}
        className={`h-9 w-full rounded-md border px-3 text-sm text-left flex items-center justify-between shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] disabled:opacity-50 ${
          error ? 'border-red-400' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)]'
        }`}
      >
        <span className={selectedName ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}>
          {resolving ? 'Guardando…' : (selectedName || 'Selecciona una categoría')}
        </span>
        <svg className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden">
          {MENU_CATEGORIES.map(cat => (
            <li key={cat}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); resolveCategory(cat) }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  selectedName === cat
                    ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-semibold'
                    : 'hover:bg-[hsl(var(--accent))]'
                }`}
              >
                {cat}
              </button>
            </li>
          ))}
        </ul>
      )}

      {resolveErr && <p className="text-xs text-red-500 mt-1">{resolveErr}</p>}
    </div>
  )
}

const isSauce = (product) => {
  const cat = String(product.category_name || '').toLowerCase()
  return cat.includes('salsa') || cat.includes('sauce')
}

function CreateRecipeModal({ isOpen, recipe, onSave, onCancel, localId, externalError }) {
  const [formData, setFormData] = useState({
    category_id:   '',
    category_name: '',
    name:          '',
    description:   '',
    price_sale:    '',
    yield_portions: '',
  })

  const [ingredients, setIngredients]     = useState([])
  const [products,    setProducts]        = useState([])
  const [loading,     setLoading]         = useState(false)
  const [savingLoading, setSavingLoading] = useState(false)
  const [errors,      setErrors]          = useState({})
  const [pickedId,    setPickedId]        = useState('')

  useEffect(() => {
    if (!isOpen) return

    if (recipe) {
      setFormData({
        category_id:    recipe.category_id    || '',
        category_name:  recipe.category_name  || '',
        name:           recipe.name           || '',
        description:    recipe.description    || '',
        price_sale:     recipe.price_sale     || '',
        yield_portions: recipe.yield_portions || '',
      })
      setIngredients(recipe.ingredients ? [...recipe.ingredients] : [])
    } else {
      setFormData({ category_id: '', category_name: '', name: '', description: '', price_sale: '', yield_portions: '' })
      setIngredients([])
    }

    setPickedId('')
    setErrors({})

    if (!localId) { setProducts([]); return }
    let cancelled = false
    setLoading(true)
    getInventoryProductsPage(localId, { limit: 500, offset: 0 })
      .then((page) => { if (!cancelled) setProducts(page?.items || []) })
      .catch(() => { if (!cancelled) setErrors((p) => ({ ...p, products: 'Error cargando productos' })) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, recipe, localId])

  const setField = (key, value) => {
    setFormData((p) => ({ ...p, [key]: value }))
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  const handlePickProduct = (e) => {
    const pid = e.target.value
    setPickedId('')
    if (!pid) return
    if (ingredients.some((i) => String(i.product_id) === pid)) return

    const product = products.find((p) => String(p.product_id) === pid)
    if (!product) return

    const sauce = isSauce(product)
    setIngredients((prev) => [...prev, {
      product_id:        pid,
      product_name:      product.product_name,
      quantity_required: sauce ? (Number(product.stock_current) || 1) : '',
      unit:              sauce ? (product.unit || 'unidad') : 'unidad',
      unit_cost_clp:     Number(product.unit_cost_clp ?? product.price_per_unit ?? 0),
      is_sauce:          sauce,
    }])
    setErrors((p) => { const n = { ...p }; delete n.ingredients; return n })
  }

  const updateIngredient = (pid, field, value) =>
    setIngredients((prev) => prev.map((i) => String(i.product_id) === pid ? { ...i, [field]: value } : i))

  const removeIngredient = (pid) =>
    setIngredients((prev) => prev.filter((i) => String(i.product_id) !== pid))

  const totalCost = ingredients.reduce(
    (s, i) => s + (Number(i.quantity_required) || 0) * Number(i.unit_cost_clp || 0), 0
  )
  const portions  = Math.max(1, parseInt(formData.yield_portions) || 1)
  const salePrice = parseFloat(formData.price_sale) || 0
  const margin    = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0

  const validate = () => {
    const e = {}
    if (!formData.name.trim())                    e.name           = 'Nombre requerido'
    if (!formData.category_id)                    e.category_id    = 'Categoría requerida (escribe y pulsa Enter)'
    if (!formData.price_sale || salePrice <= 0)   e.price_sale     = 'Precio de venta requerido y mayor a 0'
    if (!formData.yield_portions || portions < 1) e.yield_portions = 'Mínimo 1 porción'
    if (ingredients.length === 0)                 e.ingredients    = 'Agrega al menos 1 ingrediente'
    for (const ing of ingredients) {
      if (!ing.quantity_required || Number(ing.quantity_required) <= 0) {
        e.ingredients = `Cantidad inválida en "${ing.product_name}"`
        break
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSavingLoading(true)
    try {
      const payload = {
        category_id:            formData.category_id,
        name:                   formData.name.trim(),
        description:            formData.description.trim(),
        price_sale:             salePrice,
        yield_portions:         portions,
        total_cost:             totalCost,
        profit_margin_percent:  margin,
        ingredients:            ingredients.map((i) => ({
          product_id:        i.product_id,
          product_name:      i.product_name,
          quantity_required: Number(i.quantity_required),
          unit:              i.unit,
          unit_cost_clp:     i.unit_cost_clp,
        })),
      }
      if (recipe) payload.id = recipe.id
      await onSave(payload)
    } finally {
      setSavingLoading(false)
    }
  }

  const inputCls = (key) =>
    `h-9 w-full rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
      errors[key] ? 'border-red-400' : 'border-[hsl(var(--border))]'
    }`

  const selectCls = (key) =>
    `h-9 w-full rounded-md border px-3 text-sm shadow-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
      errors[key] ? 'border-red-400' : 'border-[hsl(var(--border))]'
    }`

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent
        className="max-w-3xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 860px)' }}
      >
        <DialogHeader className="shrink-0 px-7 pt-6 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle>{recipe ? 'Editar Receta' : 'Nueva Receta'}</DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Completa todos los campos para {recipe ? 'actualizar' : 'crear'} la receta
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-7 py-5 flex flex-col gap-5">

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cr-name">Nombre <span className="text-red-500">*</span></Label>
            <input
              id="cr-name"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Ingrese datos"
              className={inputCls('name')}
            />
            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
          </div>

          {/* Categoría — typeahead limitado a Completos / Sandwich */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Categoría <span className="text-red-500">*</span>
            </Label>
            <MenuCategoryInput
              localId={localId}
              selectedName={formData.category_name}
              onResolve={(id, name) => {
                setField('category_id', id)
                setFormData(p => ({ ...p, category_id: id, category_name: name }))
                setErrors(p => { const n = { ...p }; delete n.category_id; return n })
              }}
              disabled={savingLoading}
              error={!!errors.category_id}
            />
            {errors.category_id && (
              <span className="text-xs text-red-500">{errors.category_id}</span>
            )}
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cr-description">Descripción</Label>
            <textarea
              id="cr-description"
              value={formData.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Ingrese Descripcion"
              rows={2}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>

          {/* Precio + Porciones */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cr-price">Precio de Venta (CLP) <span className="text-red-500">*</span></Label>
              <input
                id="cr-price"
                type="text"
                inputMode="numeric"
                value={formData.price_sale}
                onChange={(e) => setField('price_sale', e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className={inputCls('price_sale')}
              />
              {errors.price_sale && <span className="text-xs text-red-500">{errors.price_sale}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cr-yield">Porciones que rinde <span className="text-red-500">*</span></Label>
              <input
                id="cr-yield"
                type="text"
                inputMode="numeric"
                value={formData.yield_portions}
                onChange={(e) => setField('yield_portions', e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className={inputCls('yield_portions')}
              />
              {errors.yield_portions && <span className="text-xs text-red-500">{errors.yield_portions}</span>}
            </div>
          </div>

          {/* Ingredientes */}
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Ingredientes</h3>
              {errors.ingredients && (
                <p className="text-xs text-red-500 mt-0.5">{errors.ingredients}</p>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-2">Cargando productos…</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cr-pick-product">Seleccione un Producto</Label>
                  <select
                    id="cr-pick-product"
                    value={pickedId}
                    onChange={handlePickProduct}
                    disabled={products.length === 0}
                    className={selectCls(null)}
                  >
                    <option value="">
                      {products.length === 0 ? 'Sin productos en inventario' : '— Selecciona para agregar —'}
                    </option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name}
                        {isSauce(p) ? ' 🫙 Salsa' : ''}
                        {' — '}
                        {fmt(p.unit_cost_clp ?? 0)} / u.
                      </option>
                    ))}
                  </select>
                </div>

                {ingredients.length > 0 && (
                  <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                    <div
                      className="grid gap-2 px-4 py-2 bg-[hsl(var(--muted)/0.3)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide"
                      style={{ gridTemplateColumns: '1fr 100px 140px 88px 32px' }}
                    >
                      <span>Producto</span>
                      <span className="text-center">Cantidad</span>
                      <span>Formato</span>
                      <span className="text-right">Subtotal</span>
                      <span />
                    </div>

                    <div className="divide-y divide-[hsl(var(--border)/0.3)] bg-[hsl(var(--card))]">
                      {ingredients.map((ing) => {
                        const subtotal = (Number(ing.quantity_required) || 0) * Number(ing.unit_cost_clp || 0)
                        return (
                          <div
                            key={ing.product_id}
                            className="grid items-center gap-2 px-4 py-2.5"
                            style={{ gridTemplateColumns: '1fr 100px 140px 88px 32px' }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{ing.product_name}</p>
                              {ing.is_sauce && (
                                <p className="text-xs text-amber-600 font-medium">Salsa — datos heredados</p>
                              )}
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={ing.quantity_required}
                              onChange={(e) => updateIngredient(ing.product_id, 'quantity_required', e.target.value)}
                              disabled={ing.is_sauce}
                              placeholder="0"
                              className={`h-8 w-full text-center rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] ${
                                ing.is_sauce
                                  ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                              }`}
                            />
                            <select
                              value={ing.unit}
                              onChange={(e) => updateIngredient(ing.product_id, 'unit', e.target.value)}
                              disabled={ing.is_sauce}
                              className={`h-8 w-full rounded-md border px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] ${
                                ing.is_sauce
                                  ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                              }`}
                            >
                              {UNITS.map((u) => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                            <span className="text-xs text-right font-semibold text-[hsl(var(--foreground))]">
                              {fmt(subtotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeIngredient(ing.product_id)}
                              className="flex items-center justify-center w-7 h-7 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <div
                      className="grid items-center gap-2 px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.15)]"
                      style={{ gridTemplateColumns: '1fr 100px 140px 88px 32px' }}
                    >
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase col-span-3 text-right">
                        Costo total
                      </span>
                      <span className="text-sm font-bold text-right text-[hsl(var(--primary))]">
                        {fmt(totalCost)}
                      </span>
                      <span />
                    </div>
                  </div>
                )}

                {ingredients.length === 0 && (
                  <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-4 border border-dashed border-[hsl(var(--border))] rounded-lg">
                    Sin ingredientes — selecciona un producto arriba para agregar
                  </p>
                )}
              </>
            )}
          </div>

          {/* Resumen financiero */}
          {ingredients.length > 0 && salePrice > 0 && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[hsl(var(--border))] p-4 bg-[hsl(var(--accent)/0.3)]">
              {[
                ['Costo total',       fmt(totalCost)],
                ['Costo por porción', fmt(totalCost / portions)],
                ['Precio de venta',   fmt(salePrice)],
                ['Margen',            `${margin.toFixed(1)}%`, margin >= 30],
              ].map(([label, val, isGood]) => (
                <div key={label} className="flex justify-between items-center bg-[hsl(var(--card))] rounded-md px-3 py-2 shadow-sm">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className={`text-sm font-bold ${isGood === true ? 'text-emerald-600' : isGood === false ? 'text-red-500' : 'text-[hsl(var(--foreground))]'}`}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 px-7 py-4 border-t border-[hsl(var(--border))] flex-col gap-2">
          {externalError && (
            <p className="w-full rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2 text-left">
              {externalError}
            </p>
          )}
          <div className="flex gap-2 justify-end w-full">
            <Button type="button" variant="outline" onClick={onCancel} disabled={savingLoading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={savingLoading}>
              {savingLoading ? 'Guardando…' : recipe ? 'Actualizar' : 'Crear Receta'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateRecipeModal
