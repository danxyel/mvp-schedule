import { useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import client from '../api/client'
import { aplicarTemaTenant } from '../lib/temaTenant'

export default function TenantThemeProvider({ children }) {
  const { tenantSlug: slugFromUrl } = useParams()
  const location = useLocation()

  useEffect(() => {
    // Se re-evalúa en cada cambio de ruta (no solo cuando :tenantSlug
    // cambia en la URL) porque este provider envuelve toda la app una
    // sola vez — nunca se vuelve a montar al navegar. Sin esto, un
    // cliente que inicia sesión en /login (sin tenantSlug en la URL) y
    // pasa a /mis-reservas nunca recogía el tenantSlug que Login.jsx
    // recién guardó en sessionStorage, y se quedaba con el color de
    // respaldo para siempre.
    const slugFromStorage = sessionStorage.getItem('tenantSlug')
    const tenantSlug = slugFromUrl || slugFromStorage
    if (!tenantSlug) return

    let activo = true
    client.GET('/tenants/publicos').then(({ data }) => {
      if (!activo || !data) return
      const tenant = data.find((t) => t.slug === tenantSlug)
      if (tenant?.color_primario) {
        aplicarTemaTenant(tenant.color_primario)
      }
    })

    return () => {
      activo = false
    }
  }, [slugFromUrl, location.pathname])

  return children
}
