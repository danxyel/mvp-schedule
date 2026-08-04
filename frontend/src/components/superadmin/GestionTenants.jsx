import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import ConfigSmtpModal from './ConfigSmtpModal'

import { API_BASE } from '../../api/client'
const LIMIT = 20

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
const PLAN_COLOR = {
  starter: 'border-gray-200 bg-gray-100 text-gray-600',
  pro: 'border-blue-200 bg-blue-100 text-blue-700',
  enterprise: 'border-purple-200 bg-purple-100 text-purple-700',
}

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (MX)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (US)' },
  { value: 'America/New_York', label: 'Nueva York (US)' },
  { value: 'Europe/Madrid', label: 'Madrid (ES)' },
]

const MONEDAS = ['MXN', 'USD', 'EUR']

const SLUG_REGEX = /^[a-z0-9-]+$/

function slugDesdeNombre(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Badge({ value, color, children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        color ?? 'border-gray-200 bg-gray-100 text-gray-600'
      }`}
    >
      {children ?? value}
    </span>
  )
}

export default function GestionTenants() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [offset, setOffset] = useState(0)
  const [toggleLoadingId, setToggleLoadingId] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [crearLoading, setCrearLoading] = useState(false)
  const [crearError, setCrearError] = useState(null)
  const [slugEditado, setSlugEditado] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editarLoading, setEditarLoading] = useState(false)
  const [editarError, setEditarError] = useState(null)
  const [configSmtp, setConfigSmtp] = useState(null)
  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    plan: 'starter',
    timezone: 'America/Mexico_City',
    moneda: 'MXN',
    max_asesores: 5,
    max_servicios: 10,
    max_clientes: 500,
    max_reservas_mes: 1000,
  })

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${API_BASE}/api/v2/superadmin/tenants?limit=${LIMIT}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.detail ?? 'Error al cargar tenants')
        setLoading(false)
        return
      }
      setTenants(data)
      setLoading(false)
    } catch {
      setError('No se pudo conectar al servidor')
      setLoading(false)
    }
  }, [token, offset])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  const abrirModal = () => {
    setForm({
      nombre: '',
      slug: '',
      plan: 'starter',
      timezone: 'America/Mexico_City',
      moneda: 'MXN',
      max_asesores: 5,
      max_servicios: 10,
      max_clientes: 500,
      max_reservas_mes: 1000,
    })
    setSlugEditado(false)
    setCrearError(null)
    setModalAbierto(true)
  }

  const abrirEditar = (t) => {
    setForm({
      nombre: t.nombre,
      slug: t.slug,
      plan: t.plan,
      timezone: t.timezone ?? 'America/Mexico_City',
      moneda: t.moneda ?? 'MXN',
      max_asesores: t.max_asesores ?? 5,
      max_servicios: t.max_servicios ?? 10,
      max_clientes: t.max_clientes ?? 500,
      max_reservas_mes: t.max_reservas_mes ?? 1000,
    })
    setSlugEditado(true)
    setEditarError(null)
    setEditando(t)
  }

  const cambiarNombre = (nombre) => {
    setForm((prev) => ({
      ...prev,
      nombre,
      ...(slugEditado ? {} : { slug: slugDesdeNombre(nombre) }),
    }))
  }

  const patchTenant = async (id, cambios) => {
    let res
    try {
      res = await fetch(`${API_BASE}/api/v2/superadmin/tenants/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cambios),
      })
    } catch {
      throw new Error('No se pudo conectar al servidor')
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(data?.detail ?? 'No se pudo actualizar el tenant')
      err.status = res.status
      throw err
    }
    return data
  }

  const patchActivo = async (t, activo) => {
    setToggleLoadingId(t.id)
    setError(null)
    try {
      const data = await patchTenant(t.id, { activo })
      setTenants((prev) => prev.map((x) => (x.id === data.id ? data : x)))
    } catch (err) {
      setError(err.message)
    } finally {
      setToggleLoadingId(null)
    }
  }

  const alternarEstado = (t) => {
    if (t.activo) {
      setConfirmarDesactivar(t)
      return
    }
    patchActivo(t, true)
  }

  const crearTenant = async (e) => {
    e.preventDefault()
    if (crearLoading) return

    const slug = form.slug.trim().toLowerCase()
    if (!SLUG_REGEX.test(slug)) {
      setCrearError('El slug solo puede contener letras minúsculas, números y guiones')
      return
    }

    setCrearLoading(true)
    setCrearError(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/superadmin/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, slug }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409) {
        setCrearError('El slug ya existe, elige otro')
        return
      }
      if (!res.ok) {
        setCrearError(data?.detail ?? 'No se pudo crear el tenant')
        return
      }
      setTenants((prev) => [data, ...prev])
      setModalAbierto(false)
    } catch {
      setCrearError('No se pudo conectar al servidor')
    } finally {
      setCrearLoading(false)
    }
  }

  const editarTenant = async (e) => {
    e.preventDefault()
    if (editarLoading) return

    const slug = form.slug.trim().toLowerCase()
    if (!SLUG_REGEX.test(slug)) {
      setEditarError('El slug solo puede contener letras minúsculas, números y guiones')
      return
    }

    const cambios = {}
    if (form.nombre !== editando.nombre) cambios.nombre = form.nombre
    if (slug !== editando.slug) cambios.slug = slug
    if (form.plan !== editando.plan) cambios.plan = form.plan
    if (form.timezone !== editando.timezone) cambios.timezone = form.timezone
    if (form.moneda !== editando.moneda) cambios.moneda = form.moneda
    if (Number(form.max_asesores) !== editando.max_asesores) cambios.max_asesores = Number(form.max_asesores)
    if (Number(form.max_servicios) !== editando.max_servicios) cambios.max_servicios = Number(form.max_servicios)
    if (Number(form.max_clientes) !== editando.max_clientes) cambios.max_clientes = Number(form.max_clientes)
    if (Number(form.max_reservas_mes) !== editando.max_reservas_mes) {
      cambios.max_reservas_mes = Number(form.max_reservas_mes)
    }

    if (Object.keys(cambios).length === 0) {
      setEditando(null)
      return
    }

    setEditarLoading(true)
    setEditarError(null)
    try {
      const data = await patchTenant(editando.id, cambios)
      setTenants((prev) => prev.map((x) => (x.id === data.id ? data : x)))
      setEditando(null)
    } catch (err) {
      if (err.status === 409) {
        setEditarError('El slug ya existe, elige otro')
      } else {
        setEditarError(err.message)
      }
    } finally {
      setEditarLoading(false)
    }
  }

  const activos = tenants.filter((t) => t.activo).length

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded-lg bg-gray-100" />
          <div className="h-10 w-full max-w-xs rounded-lg bg-gray-100" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Gestión de Tenants</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/superadmin/usuarios')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Usuarios
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Volver
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{activos}</span> tenants activos
        </p>
        <button
          type="button"
          onClick={abrirModal}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Nuevo tenant
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchTenants}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Usuarios</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr
                key={t.id}
                onClick={() => {
                  sessionStorage.setItem('tenantSlug', t.slug)
                  sessionStorage.setItem('tenantNombre', t.nombre)
                  navigate('/admin')
                }}
                className={`cursor-pointer transition hover:bg-blue-50 ${
                  toggleLoadingId === t.id ? 'opacity-60' : ''
                }`}
                title="Entrar al tenant"
              >
                <td className="px-4 py-3 text-gray-700">{t.nombre}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">
                  {t.slug}
                </td>
                <td className="px-4 py-3">
                  <Badge value={t.plan} color={PLAN_COLOR[t.plan]}>
                    {PLAN_LABEL[t.plan] ?? t.plan}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-700">{t.total_usuarios ?? 0}</td>
                <td className="px-4 py-3">
                  <Badge
                    color={
                      t.activo
                        ? 'border-green-200 bg-green-100 text-green-700'
                        : 'border-red-200 bg-red-100 text-red-700'
                    }
                  >
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        t.smtp_configurado ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={t.smtp_configurado ? 'Email configurado' : 'Email sin configurar'}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfigSmtp(t)
                      }}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirEditar(t)
                      }}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={t.activo}
                      disabled={toggleLoadingId === t.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        alternarEstado(t)
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        t.activo ? 'bg-green-500' : 'bg-gray-300'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                          t.activo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No hay tenants registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tenants.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => {
              setLoading(true)
              setOffset(Math.max(0, offset - LIMIT))
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {Math.floor(offset / LIMIT) + 1}
          </span>
          <button
            type="button"
            disabled={tenants.length < LIMIT}
            onClick={() => {
              setLoading(true)
              setOffset(offset + LIMIT)
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      )}

      {modalAbierto && (
        <Modal title="Nuevo tenant" onClose={() => setModalAbierto(false)}>
          <form onSubmit={crearTenant} className="space-y-4" noValidate>
            <div>
              <label htmlFor="tenant-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="tenant-nombre"
                type="text"
                required
                value={form.nombre}
                onChange={(e) => cambiarNombre(e.target.value)}
                placeholder="Ej. Consultoría XYZ"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="tenant-slug" className="mb-1 block text-sm font-medium text-gray-700">
                Slug *
              </label>
              <input
                id="tenant-slug"
                type="text"
                required
                value={form.slug}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, slug: e.target.value }))
                  setSlugEditado(true)
                  if (crearError) setCrearError(null)
                }}
                placeholder="ej. consultoria-xyz"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Solo letras minúsculas, números y guiones
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="tenant-plan" className="mb-1 block text-sm font-medium text-gray-700">
                  Plan
                </label>
                <select
                  id="tenant-plan"
                  value={form.plan}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label htmlFor="tenant-timezone" className="mb-1 block text-sm font-medium text-gray-700">
                  Timezone
                </label>
                <select
                  id="tenant-timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tenant-moneda" className="mb-1 block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <select
                  id="tenant-moneda"
                  value={form.moneda}
                  onChange={(e) => setForm((prev) => ({ ...prev, moneda: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {crearError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {crearError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {crearLoading ? 'Creando...' : 'Crear tenant'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editando && (
        <Modal title="Editar tenant" onClose={() => setEditando(null)} maxWidth="max-w-2xl">
          <form onSubmit={editarTenant} className="space-y-4" noValidate>
            <div>
              <label htmlFor="edit-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="edit-nombre"
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-slug" className="mb-1 block text-sm font-medium text-gray-700">
                Slug *
              </label>
              <input
                id="edit-slug"
                type="text"
                required
                value={form.slug}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, slug: e.target.value }))
                  if (editarError) setEditarError(null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Solo letras minúsculas, números y guiones
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="edit-plan" className="mb-1 block text-sm font-medium text-gray-700">
                  Plan
                </label>
                <select
                  id="edit-plan"
                  value={form.plan}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-timezone" className="mb-1 block text-sm font-medium text-gray-700">
                  Timezone
                </label>
                <select
                  id="edit-timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-moneda" className="mb-1 block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <select
                  id="edit-moneda"
                  value={form.moneda}
                  onChange={(e) => setForm((prev) => ({ ...prev, moneda: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="edit-max-asesores" className="mb-1 block text-sm font-medium text-gray-700">
                  Max asesores
                </label>
                <input
                  id="edit-max-asesores"
                  type="number"
                  min="0"
                  value={form.max_asesores}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_asesores: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-max-servicios" className="mb-1 block text-sm font-medium text-gray-700">
                  Max servicios
                </label>
                <input
                  id="edit-max-servicios"
                  type="number"
                  min="1"
                  value={form.max_servicios}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_servicios: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-max-clientes" className="mb-1 block text-sm font-medium text-gray-700">
                  Max clientes
                </label>
                <input
                  id="edit-max-clientes"
                  type="number"
                  min="1"
                  value={form.max_clientes}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_clientes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-max-reservas" className="mb-1 block text-sm font-medium text-gray-700">
                  Max reservas/mes
                </label>
                <input
                  id="edit-max-reservas"
                  type="number"
                  min="1"
                  value={form.max_reservas_mes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, max_reservas_mes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {editarError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {editarError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editarLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editarLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmarDesactivar && (
        <Modal
          title="Desactivar tenant"
          onClose={() => setConfirmarDesactivar(null)}
          maxWidth="max-w-md"
        >
          <p className="mb-5 text-sm text-gray-600">
            ¿Desactivar tenant{' '}
            <span className="font-semibold text-gray-900">{confirmarDesactivar.nombre}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmarDesactivar(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={toggleLoadingId === confirmarDesactivar.id}
              onClick={() => {
                patchActivo(confirmarDesactivar, false)
                setConfirmarDesactivar(null)
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {toggleLoadingId === confirmarDesactivar.id ? 'Desactivando...' : 'Desactivar'}
            </button>
          </div>
        </Modal>
      )}

      {configSmtp && (
        <ConfigSmtpModal
          tenant={configSmtp}
          token={token}
          onClose={() => setConfigSmtp(null)}
          onGuardado={(actualizado) => {
            setTenants((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)))
          }}
        />
      )}
    </div>
  )
}
