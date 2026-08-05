import { getAuthContext } from './apiClient'

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}/api${normalizedPath}`
}

export async function uploadReceipt(file, { localId }) {
  const { token } = await getAuthContext()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('local_id', localId)

  const response = await fetch(buildUrl('/uploads/comprobantes'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.detail || json?.message || response.statusText || 'Error al subir imagen')
  }

  return json.url || json.public_url || json.receipt_url || null
}
