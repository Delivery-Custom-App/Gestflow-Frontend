import { useState, useEffect } from 'react'
import { getInventoryProductsPage } from '../../../lib/inventoryApi'
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

const isSauce = (product) => {
  const cat = String(product.category_name || '').toLowerCase()
  return cat.includes('salsa') || cat.includes('sauce')
}

function CreateRecipeModal({ isOpen, recipe, categories, onSave, onCancel, localId, externalError }) {
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: '',
    price_sale: '',
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
        name:           recipe.name           || '',
        description:    recipe.description    || '',
        price_sale:     recipe.price_sale     || '',
        yield_portions: recipe.yield_portions || '',
      })
      setIngredients(recipe.ingredients ? [...recipe.ingredients] : [])
    } else {
      setFormData({ category_id: '', name: '', description: '', price_sale: '', yield_portions: '' })
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

  /* ── helpers de formulario ── */
  const setField = (key, value) => {
    setFormData((p) => ({ ...p, [key]: value }))
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  /* ── Seleccionar producto del dropdown → añade inmediatamente ── */
  const handlePickProduct = (e) => {
    const pid = e.target.value
    setPickedId('')
    if (!pid) return
    if (ingredients.some((i) => String(i.product_id) === pid)) return // ya está

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

  /* ── Cálculos financieros ── */
  const totalCost = ingredients.reduce(
    (s, i) => s + (Number(i.quantity_required) || 0) * Number(i.unit_cost_clp || 0), 0
  )
  const portions  = Math.max(1, parseInt(formData.yield_portions) || 1)
  const salePrice = parseFloat(formData.price_sale) || 0
  const margin    = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0

  /* ── Validación ── */
  const validate = () => {
    const e = {}
    if (!formData.name.trim())           e.name           = 'Nombre requerido'
    if (!formData.category_id)           e.category_id    = 'Categoría requerida'
    if (!formData.price_sale || salePrice <= 0) e.price_sale = 'Precio de venta requerido y mayor a 0'
    if (!formData.yield_portions || portions < 1) e.yield_portions = 'Mínimo 1 porción'
    if (ingredients.length === 0)        e.ingredients    = 'Agrega al menos 1 ingrediente'
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
          product_id:       i.product_id,
          product_name:     i.product_name,
          quantity_required: Number(i.quantity_required),
          unit:             i.unit,
          unit_cost_clp:    i.unit_cost_clp,
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
    `h-9 w-full rounded-md border px-3 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
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

          {/* Categoría */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cr-category">Categoría <span className="text-red-500">*</span></Label>
            <select
              id="cr-category"
              value={formData.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
              className={selectCls('category_id')}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {errors.category_id && <span className="text-xs text-red-500">{errors.category_id}</span>}
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
              className="w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
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

          {/* ── Ingredientes ── */}
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
                {/* Selector de producto → se añade al instante */}
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

                {/* Tabla de ingredientes */}
                {ingredients.length > 0 && (
                  <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                    {/* Header */}
                    <div className="grid gap-2 px-4 py-2 bg-[hsl(var(--muted)/0.3)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide"
                      style={{ gridTemplateColumns: '1fr 100px 140px 88px 32px' }}
                    >
                      <span>Producto</span>
                      <span className="text-center">Cantidad</span>
                      <span>Formato</span>
                      <span className="text-right">Subtotal</span>
                      <span />
                    </div>

                    {/* Filas */}
                    <div className="divide-y divide-[hsl(var(--border)/0.3)] bg-white">
                      {ingredients.map((ing) => {
                        const subtotal = (Number(ing.quantity_required) || 0) * Number(ing.unit_cost_clp || 0)
                        return (
                          <div
                            key={ing.product_id}
                            className="grid items-center gap-2 px-4 py-2.5"
                            style={{ gridTemplateColumns: '1fr 100px 140px 88px 32px' }}
                          >
                            {/* Nombre */}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{ing.product_name}</p>
                              {ing.is_sauce && (
                                <p className="text-xs text-amber-600 font-medium">Salsa — datos heredados</p>
                              )}
                            </div>

                            {/* Cantidad */}
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
                                  : 'border-[hsl(var(--border))] bg-white'
                              }`}
                            />

                            {/* Formato de medida */}
                            <select
                              value={ing.unit}
                              onChange={(e) => updateIngredient(ing.product_id, 'unit', e.target.value)}
                              disabled={ing.is_sauce}
                              className={`h-8 w-full rounded-md border px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] ${
                                ing.is_sauce
                                  ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                                  : 'border-[hsl(var(--border))] bg-white'
                              }`}
                            >
                              {UNITS.map((u) => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>

                            {/* Subtotal */}
                            <span className="text-xs text-right font-semibold text-[hsl(var(--foreground))]">
                              {fmt(subtotal)}
                            </span>

                            {/* Eliminar */}
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

                    {/* Total */}
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
                ['Costo total',        fmt(totalCost)],
                ['Costo por porción',  fmt(totalCost / portions)],
                ['Precio de venta',    fmt(salePrice)],
                ['Margen',             `${margin.toFixed(1)}%`, margin >= 30],
              ].map(([label, val, isGood]) => (
                <div key={label} className="flex justify-between items-center bg-white rounded-md px-3 py-2 shadow-sm">
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
