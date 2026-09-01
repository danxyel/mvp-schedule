import { useState, useEffect, useCallback, useRef } from 'react'
import client from '../../api/client'
import { errorMensaje } from '../../utils/errores'
import { aplicarTemaTenant } from '../../lib/temaTenant'
import { Button, Card, Field } from '../ui'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']
const MENSAJES_ERROR = {
  logo_formato_invalido: 'Solo se permiten imágenes PNG, JPEG o WebP.',
  logo_muy_grande: 'El logo no debe superar los 2 MB.',
  logo_no_disponible: 'No se pudo conectar con el almacenamiento de logos. Revisa la configuración de Cloudinary.',
}

export default function GestionPersonalizacion({ tenantSlug, token }) {
  const [datos, setDatos] = useState(null)
  const [colorInput, setColorInput] = useState('#2563eb')
  const [archivoLogo, setArchivoLogo] = useState(null)
  const [previewLogo, setPreviewLogo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardandoColor, setGuardandoColor] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [quitandoLogo, setQuitandoLogo] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)
  const fileRef = useRef(null)

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/personalizacion',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setDatos(data)
    setColorInput(data.color_primario)
    aplicarTemaTenant(data.color_primario)
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchDatos()
  }, [fetchDatos])

  const mostrarExito = (mensaje) => {
    setExito(mensaje)
    setTimeout(() => setExito(null), 3000)
  }

  const guardarColor = async (e) => {
    e.preventDefault()
    if (guardandoColor || !/^#[0-9a-fA-F]{6}$/.test(colorInput)) return

    setGuardandoColor(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.PATCH(
      '/api/v2/{tenant_slug}/admin/personalizacion',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
        body: { color_primario: colorInput },
      }
    )
    setGuardandoColor(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setDatos(data)
    aplicarTemaTenant(data.color_primario)
    mostrarExito('Color guardado')
  }

  const onSeleccionarArchivo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setExito(null)

    if (!TIPOS_LOGO.includes(file.type)) {
      setError(MENSAJES_ERROR.logo_formato_invalido)
      setArchivoLogo(null)
      setPreviewLogo(null)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(MENSAJES_ERROR.logo_muy_grande)
      setArchivoLogo(null)
      setPreviewLogo(null)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setArchivoLogo(file)
    setPreviewLogo(URL.createObjectURL(file))
  }

  const subirLogo = async (e) => {
    e.preventDefault()
    if (!archivoLogo || subiendoLogo) return

    setSubiendoLogo(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/personalizacion/logo',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
        body: { logo: archivoLogo },
        // openapi-fetch serializa el body con JSON.stringify por default,
        // lo que manda un File como "{}" — el backend espera
        // multipart/form-data (UploadFile). bodySerializer que devuelve
        // FormData hace que openapi-fetch omita el Content-Type y deje
        // que el navegador ponga el boundary correcto.
        bodySerializer(body) {
          const fd = new FormData()
          fd.append('logo', body.logo)
          return fd
        },
      }
    )
    setSubiendoLogo(false)
    if (fetchErr) {
      const codigo = fetchErr?.codigo || fetchErr?.detail?.codigo
      setError(MENSAJES_ERROR[codigo] || errorMensaje(fetchErr))
      return
    }
    setDatos(data)
    setArchivoLogo(null)
    setPreviewLogo(null)
    if (fileRef.current) fileRef.current.value = ''
    mostrarExito('Logo actualizado')
  }

  const quitarLogo = async () => {
    if (!datos?.logo_url || quitandoLogo) return
    if (!window.confirm('¿Quitar el logo actual? Se mostrará el avatar con la inicial del tenant.')) return

    setQuitandoLogo(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/personalizacion/logo',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setQuitandoLogo(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setDatos(data)
    setArchivoLogo(null)
    setPreviewLogo(null)
    if (fileRef.current) fileRef.current.value = ''
    mostrarExito('Logo eliminado')
  }

  const onColorHexChange = (valor) => {
    let hex = valor.trim()
    if (!hex.startsWith('#') && /^[0-9a-fA-F]{0,6}$/.test(hex)) {
      hex = `#${hex}`
    }
    if (/^#[0-9a-fA-F]{0,6}$/.test(hex)) {
      setColorInput(hex.toLowerCase())
      aplicarTemaTenant(hex)
    } else {
      setColorInput(valor)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Personalización</h3>
        <p className="text-sm text-gray-500">Color de marca y logo de {datos?.nombre}</p>
      </div>

      {exito && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {exito}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <form onSubmit={guardarColor} className="space-y-4">
          <h4 className="font-medium text-gray-900">Color primario</h4>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(colorInput) ? colorInput : '#2563eb'}
              onChange={(e) => onColorHexChange(e.target.value)}
              className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 sm:w-20"
              aria-label="Color primario"
            />
            <Field
              label="Código HEX"
              name="color_hex"
              value={colorInput}
              onChange={(e) => onColorHexChange(e.target.value)}
              placeholder="#2563eb"
              required
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Vista previa</p>
            <Button type="submit" variant="primary" loading={guardandoColor}>
              Guardar color
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <form onSubmit={subirLogo} className="space-y-4">
          <h4 className="font-medium text-gray-900">Logo</h4>

          <div className="flex items-center gap-4">
            {previewLogo ? (
              <img
                src={previewLogo}
                alt="Vista previa del logo"
                className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
              />
            ) : datos?.logo_url ? (
              <img
                src={datos.logo_url}
                alt={`Logo de ${datos.nombre}`}
                className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
              />
            ) : (
              <span
                className="flex h-16 w-16 items-center justify-center rounded-lg text-xl font-bold text-white"
                style={{ backgroundColor: datos?.color_primario || '#2563eb' }}
              >
                {datos?.nombre?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onSeleccionarArchivo}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
              />
              <p className="mt-1 text-xs text-gray-500">PNG, JPEG o WebP. Máximo 2 MB.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={subiendoLogo}
              disabled={!archivoLogo}
              fullWidth={false}
            >
              Subir logo
            </Button>
            {datos?.logo_url && (
              <Button
                type="button"
                variant="outline"
                onClick={quitarLogo}
                loading={quitandoLogo}
                fullWidth={false}
              >
                Quitar logo
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
