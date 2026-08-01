import createClient from 'openapi-fetch'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = createClient({
  baseUrl: API_BASE,
})

export default client
