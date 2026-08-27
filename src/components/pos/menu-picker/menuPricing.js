// Cambio de embutido suma este recargo al precio base
export const EMBUTIDO_SURCHARGE = 1500

export const EMBUTIDOS = [
  { id: 'churrasco',   label: 'Churrasco',   match: 'churrasco' },
  { id: 'lomito',      label: 'Lomito',       match: 'lomito'    },
  { id: 'champinones', label: 'Champiñones',  match: 'champiñon' },
]

export const SANDWICH_PROTEINAS = [
  { id: 'churrasco',   label: 'Churrasco',   match: 'churrasco' },
  { id: 'lomito',      label: 'Lomito',       match: 'lomito'    },
  { id: 'pollo',       label: 'Pollo',        match: 'pollo'     },
  { id: 'hamburguesa', label: 'Hamburguesa',  match: 'hamburgues'},
  { id: 'champinones', label: 'Champiñones',  match: 'champiñon' },
]

export const AGREGADOS = [
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
export function calcItemPrice(basePrice, customization) {
  if (!customization) return basePrice
  const embutidoExtra = customization.embutido ? EMBUTIDO_SURCHARGE : 0
  const agregadosExtra = (customization.agregados || []).reduce((sum, label) => {
    const a = AGREGADOS.find(ag => ag.label === label)
    return sum + (a?.price || 0)
  }, 0)
  return basePrice + embutidoExtra + agregadosExtra
}

export function norm(s = '') {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function productKey(id) { return `p:${id}` }

export function isCompleto(item) { return item.type === 'recipe' && norm(item.categoryName || '').includes('completo') }
