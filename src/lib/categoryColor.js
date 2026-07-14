const CATEGORY_TONES = [
  { bg: 'hsl(172 66% 94%)', border: 'hsl(172 58% 78%)', text: 'hsl(174 72% 23%)', rail: 'hsl(172 58% 70%)' },
  { bg: 'hsl(212 86% 96%)', border: 'hsl(212 76% 82%)', text: 'hsl(215 78% 30%)', rail: 'hsl(212 76% 72%)' },
  { bg: 'hsl(265 72% 96%)', border: 'hsl(265 64% 84%)', text: 'hsl(265 58% 34%)', rail: 'hsl(265 64% 76%)' },
  { bg: 'hsl(32 92% 95%)', border: 'hsl(32 84% 80%)', text: 'hsl(30 82% 29%)', rail: 'hsl(32 84% 70%)' },
  { bg: 'hsl(338 78% 96%)', border: 'hsl(338 68% 84%)', text: 'hsl(338 64% 32%)', rail: 'hsl(338 68% 76%)' },
  { bg: 'hsl(145 58% 94%)', border: 'hsl(145 52% 78%)', text: 'hsl(146 68% 25%)', rail: 'hsl(145 52% 68%)' },
]

function hashCategoryKey(key) {
  let hash = 0
  const value = String(key || '')
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getCategoryTone(category) {
  const key = category?.id || category?.category_id || category?.name || category?.category_name || 'sin-categoria'
  return CATEGORY_TONES[hashCategoryKey(key) % CATEGORY_TONES.length]
}
