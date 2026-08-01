import { useState, useEffect, useCallback } from 'react'
import createClient from 'openapi-fetch'
import HorariosAsesor from './HorariosAsesor'
import Modal from '../common/Modal'

const client = createClient({ baseUrl: 'http://localhost:8000' })

const ROL_BADGE = {
  superadmin: 'border-gray-900 bg-gray-900 text-white',
  admin: 'border-purple-200 bg-purple-100 text-purple-700',
  asesor: 'border-blue-200 bg-blue-100 text-blue-700',
  cliente: 'border-gray-200 bg-gray-100 text-gray-600',
}

const ROL_LABEL = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  asesor: 'Asesor',
  cliente: 'Cliente',
}

const ROLES_CAMBIABLES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'asesor', label: 'Asesor' },
  { value: 'admin', label: 'Admin' },
]

const ESTADO_LABEL = {
  true: 'Activo',
  false: 'Inactivo',
}

const ESTADO_BADGE = {
  true: 'border-green-200 bg-green-100 text-green-700',
  false: 'border-gray-200 bg-gray-100 text-gray-600',
}

function errorMensaje(err) {
  return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err)
}

function Badge({ value, map, labelMap }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        map[value] ?? 'border-gray-200 bg-gray-100 text-gray-600'
      }`}
    >
      {labelMap[value] ?? value}
    </span>
  )
}

export default function GestionUsuarios({ tenantSlug, token }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [invitarAbierto, setInvitarAbierto] = useState(false)
  const [invitarLoading, setInvitarLoading] = useState(false)
  const [invitarError, setInvitarError] = useState(null)
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'cliente', password: '' })
  const [cambiandoRol, setCambiandoRol] = useState(null)
  const [confirmarDesvincular, setConfirmarDesvincular] = useState(null)
  const [desvinculando, setDesvinculando] = useState(false)
  const [asesorHorarios, setAsesorHorarios] = useState(null)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/usuarios',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setUsuarios(data ?? [])
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchUsuarios()
  }, [fetchUsuarios])

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchUsuarios()
  }

  const abrirInvitar = () => {
    setForm({ email: '', nombre: '', rol: 'cliente', password: '' })
    setInvitarError(null)
    setInvitarAbierto(true)
  }

  const invitarUsuario = async (e) => {
    e.preventDefault()
    if (invitarLoading) return

    if (!form.email.trim() || !form.nombre.trim()) {
      setInvitarError('Email y nombre son obligatorios')
      return
    }

    setInvitarLoading(true)
    setInvitarError(null)
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/usuarios/invitar',
      {
        params: { path: { tenant_slug: tenantSlug } },
        body: {
          email: form.email.trim(),
          nombre: form.nombre.trim(),
          rol: form.rol,
          password: form.password.trim() || null,
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setInvitarLoading(false)
    if (fetchErr) {
      if (response?.status === 409) {
        setInvitarError('El usuario ya está vinculado a este tenant')
        return
      }
      if (response?.status === 422) {
        setInvitarError('Verifica los datos ingresados')
        return
      }
      setInvitarError(errorMensaje(fetchErr))
      return
    }
    setUsuarios((prev) => [...prev, data])
    setInvitarAbierto(false)
  }

  const cambiarRol = async (u, nuevoRol) => {
    if (nuevoRol === u.rol) return
    setCambiandoRol(u.id)
    setAccionError(null)
    const { data, error: fetchErr } = await client.PATCH(
      '/api/v2/{tenant_slug}/admin/usuarios/{ut_id}/rol',
      {
        params: { path: { tenant_slug: tenantSlug, ut_id: u.id } },
        body: { rol: nuevoRol },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCambiandoRol(null)
    if (fetchErr) {
      setAccionError(errorMensaje(fetchErr))
      fetchUsuarios()
      return
    }
    setUsuarios((prev) => prev.map((x) => (x.id === data.id ? data : x)))
  }

  const desvincular = async (u) => {
    setDesvinculando(true)
    setAccionError(null)
    const { error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/usuarios/{ut_id}',
      {
        params: { path: { tenant_slug: tenantSlug, ut_id: u.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setDesvinculando(false)
    setConfirmarDesvincular(null)
    if (fetchErr) {
      setAccionError(errorMensaje(fetchErr))
      fetchUsuarios()
      return
    }
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: false } : x)))
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-full max-w-xs rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar usuarios</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={reintentar}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{usuarios.length}</span> usuarios vinculados
        </p>
        <button
          type="button"
          onClick={abrirInvitar}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Invitar usuario
        </button>
      </div>

      {accionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {accionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="transition hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{u.nombre}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{u.email}</td>
                <td className="px-4 py-3">
                  {u.rol === 'superadmin' ? (
                    <Badge value={u.rol} map={ROL_BADGE} labelMap={ROL_LABEL} />
                  ) : (
                    <select
                      value={u.rol}
                      disabled={cambiandoRol === u.id}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ROLES_CAMBIABLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge value={u.activo} map={ESTADO_BADGE} labelMap={ESTADO_LABEL} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {u.rol === 'asesor' && u.activo && (
                    <button
                      type="button"
                      onClick={() => setAsesorHorarios(u)}
                      className="mr-2 rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      Horarios
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmarDesvincular(u)}
                    disabled={!u.activo || u.rol === 'superadmin'}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Desvincular
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No hay usuarios vinculados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invitarAbierto && (
        <Modal title="Invitar usuario" onClose={() => setInvitarAbierto(false)}>
          <form onSubmit={invitarUsuario} className="space-y-4" noValidate>
            <div>
              <label htmlFor="invitar-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="invitar-nombre"
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre del usuario"
              />
            </div>

            <div>
              <label htmlFor="invitar-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                id="invitar-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="invitar-rol" className="mb-1 block text-sm font-medium text-gray-700">
                Rol inicial
              </label>
              <select
                id="invitar-rol"
                value={form.rol}
                onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              >
                {ROLES_CAMBIABLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="invitar-password" className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña inicial
                <span className="font-normal text-gray-400"> (opcional)</span>
              </label>
              <input
                id="invitar-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
              />
              <p className="mt-1 text-xs text-gray-400">
                Si la defines, el usuario puede entrar de inmediato. Si la omites, el invitado se
                registra solo con su email.
              </p>
            </div>

            {invitarError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {invitarError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInvitarAbierto(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={invitarLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invitarLoading ? 'Invitando...' : 'Invitar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmarDesvincular && (
        <Modal
          title="Desvincular usuario"
          onClose={() => setConfirmarDesvincular(null)}
          maxWidth="max-w-md"
        >
          <p className="mb-5 text-sm text-gray-600">
            ¿Desvincular a <span className="font-semibold text-gray-900">{confirmarDesvincular.nombre}</span>?
            Ya no tendrá acceso a este tenant.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmarDesvincular(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={desvinculando}
              onClick={() => desvincular(confirmarDesvincular)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {desvinculando ? 'Desvinculando...' : 'Desvincular'}
            </button>
          </div>
        </Modal>
      )}

      {asesorHorarios && (
        <HorariosAsesor
          asesor={asesorHorarios}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => setAsesorHorarios(null)}
        />
      )}
    </div>
  )
}
