import createClient from 'openapi-fetch'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = createClient({
  baseUrl: API_BASE,
})

// Interceptor para agregar headers de autenticación automáticamente
const originalFetch = client.fetch
client.fetch = async (url, init) => {
  const token = localStorage.getItem('acceso_token') || sessionStorage.getItem('acceso_token')

  const headers = new Headers(init?.headers || {})

  // Agregar token si existe
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Asegurar que Content-Type esté configurado para JSON en POST
  if ((init?.method === 'POST' || init?.method === 'PUT' || init?.method === 'PATCH') &&
      !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return originalFetch.call(client, url, {
    ...init,
    headers,
  })
}

export default client
