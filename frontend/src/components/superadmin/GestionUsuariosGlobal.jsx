import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import Modal from '../common/Modal'
import { errorMensaje } from '../../utils/errores'

const LIMIT = 20
const ROLES_VINCULABLES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'asesor', label: 'Asesor' },
  { value: 'admin', label: 'Admin' },
]

function Badge({ color, children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        color ?? 'border-gray-200 bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  )
}

function fechaCorta(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function diasDesde(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function GestionUsuariosGlobal() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  const authHeaders = { Authorization: `Bearer ${token}` }

  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [detalle, setDetalle] = useState(null)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [detalleError, setDetalleError] = useState(null)

  const [tenants, setTenants] = useState([])

  const [vincularAbierto, setVincularAbierto] = useState(false)
  const [vincularForm, setVincularForm] = useState({ email: '', nombre: '', rol: 'cliente', tenant_id: '' })
  const [vincularLoading, setVincularLoading] = useState(false)
  const [vincularError, setVincularError] = useState(null)

  const [desvincularLoadingId, setDesvincularLoadingId] = useState(null)

  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [desactivarLoading, setDesactivarLoading] = useState(false)
  const [desactivarError, setDesactivarError] = useState(null)

  const [confirmarPurgar, setConfirmarPurgar] = useState(null)
  const [purgarLoading, setPurgarLoading] = useState(false)
  const [purgarError, setPurgarError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q.trim())
      setOffset(0)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET('/api/v2/superadmin/usuarios', {
      params: { query: { q: qDebounced || undefined, limit: LIMIT, offset } },
      headers: authHeaders,
    })
    if (fetchErr) {
      setError(errorMensaje(fetchErr) ?? 'Error al cargar usuarios')
      setLoading(false)
      return
    }
    setItems(data.items)
    setTotal(data.paginacion.total)
    setLoading(false)
  }, [qDebounced, offset, token])

  useEffect(() => {
    fetchUsuarios()
  }, [fetchUsuarios])

  useEffect(() => {
    client.GET('/api/v2/superadmin/tenants', {
      params: { query: { limit: 200 } },
      headers: authHeaders,
    }).then(({ data }) => {
      if (data) setTenants(data)
    })
  }, [token])

  const abrirDetalle = async (usuarioId) => {
    setDetalle({ id: usuarioId })
    setDetalleLoading(true)
    setDetalleError(null)
    const { data, error: fetchErr } = await client.GET('/api/v2/superadmin/usuarios/{usuario_id}', {
      params: { path: { usuario_id: usuarioId } },
      headers: authHeaders,
    })
    setDetalleLoading(false)
    if (fetchErr) {
      setDetalleError(errorMensaje(fetchErr) ?? 'No se pudo cargar el usuario')
      return
    }
    setDetalle(data)
  }

  const refrescarDetalle = async (usuarioId) => {
    const { data } = await client.GET('/api/v2/superadmin/usuarios/{usuario_id}', {
      params: { path: { usuario_id: usuarioId } },
      headers: authHeaders,
    })
    if (data) setDetalle(data)
  }

  const abrirVincular = (emailPrecargado = '') => {
    setVincularForm({ email: emailPrecargado, nombre: '', rol: 'cliente', tenant_id: tenants[0]?.id ?? '' })
    setVincularError(null)
    setVincularAbierto(true)
  }

  const vincular = async (e) => {
    e.preventDefault()
    if (vincularLoading) return
    if (!vincularForm.tenant_id) {
      setVincularError('Selecciona un tenant')
      return
    }
    setVincularLoading(true)
    setVincularError(null)
    const { error: fetchErr } = await client.POST('/api/v2/superadmin/usuarios/vincular', {
      body: {
        email: vincularForm.email.trim(),
        nombre: vincularForm.nombre.trim(),
        rol: vincularForm.rol,
        tenant_id: Number(vincularForm.tenant_id),
      },
      headers: authHeaders,
    })
    setVincularLoading(false)
    if (fetchErr) {
      setVincularError(errorMensaje(fetchErr) ?? 'No se pudo vincular al usuario')
      return
    }
    setVincularAbierto(false)
    fetchUsuarios()
    if (detalle?.id) refrescarDetalle(detalle.id)
  }

  const desvincular = async (usuarioId, tenantId) => {
    setDesvincularLoadingId(tenantId)
    const { error: fetchErr } = await client.POST(
      '/api/v2/superadmin/usuarios/{usuario_id}/desvincular/{tenant_id}',
      {
        params: { path: { usuario_id: usuarioId, tenant_id: tenantId } },
        headers: authHeaders,
      },
    )
    setDesvincularLoadingId(null)
    if (fetchErr) {
      setDetalleError(errorMensaje(fetchErr) ?? 'No se pudo desvincular')
      return
    }
    refrescarDetalle(usuarioId)
    fetchUsuarios()
  }

  const desactivar = async () => {
    if (!confirmarDesactivar) return
    setDesactivarLoading(true)
    setDesactivarError(null)
    const { error: fetchErr } = await client.POST('/api/v2/superadmin/usuarios/{usuario_id}/desactivar', {
      params: { path: { usuario_id: confirmarDesactivar.id } },
      headers: authHeaders,
    })
    setDesactivarLoading(false)
    if (fetchErr) {
      setDesactivarError(errorMensaje(fetchErr) ?? 'No se pudo desactivar la cuenta')
      return
    }
    const id = confirmarDesactivar.id
    setConfirmarDesactivar(null)
    fetchUsuarios()
    if (detalle?.id === id) refrescarDetalle(id)
  }

  const purgar = async () => {
    if (!confirmarPurgar) return
    setPurgarLoading(true)
    setPurgarError(null)
    const { error: fetchErr } = await client.POST('/api/v2/superadmin/usuarios/{usuario_id}/purgar', {
      params: { path: { usuario_id: confirmarPurgar.id } },
      headers: authHeaders,
    })
    setPurgarLoading(false)
    if (fetchErr) {
      setPurgarError(errorMensaje(fetchErr) ?? 'No se pudo purgar la cuenta')
      return
    }
    const id = confirmarPurgar.id
    setConfirmarPurgar(null)
    setDetalle(null)
    fetchUsuarios()
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Usuarios globales</h2>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por email o nombre..."
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => abrirVincular()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Vincular usuario
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchUsuarios}
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
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Tenants</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))
            ) : (
              items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => abrirDetalle(u.id)}
                  className="cursor-pointer transition hover:bg-blue-50"
                >
                  <td className="px-4 py-3 text-gray-700">{u.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-700">{u.total_tenants}</td>
                  <td className="px-4 py-3">
                    {u.activo ? (
                      <Badge color="border-green-200 bg-green-100 text-green-700">Activo</Badge>
                    ) : (
                      <Badge color="border-red-200 bg-red-100 text-red-700">
                        Desactivado {fechaCorta(u.desactivado_en)}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  {qDebounced
                    ? 'Sin resultados para esa búsqueda.'
                    : 'No hay usuarios registrados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && qDebounced && items.length === 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-sm text-blue-700">
            ¿"{qDebounced}" es un email que aún no existe en el sistema?
          </p>
          <button
            type="button"
            onClick={() => abrirVincular(qDebounced.includes('@') ? qDebounced : '')}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
          >
            Vincular
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + LIMIT, total)} de {total}
          </span>
          <button
            type="button"
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset(offset + LIMIT)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      )}

      {/* ── Modal: vincular usuario ─────────────────────────────────────── */}
      {vincularAbierto && (
        <Modal title="Vincular usuario a tenant" onClose={() => setVincularAbierto(false)}>
          <form onSubmit={vincular} className="space-y-4" noValidate>
            <div>
              <label htmlFor="v-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                id="v-email"
                type="email"
                required
                value={vincularForm.email}
                onChange={(e) => setVincularForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Si el email ya existe en el sistema, se vincula sin duplicarlo.
              </p>
            </div>
            <div>
              <label htmlFor="v-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="v-nombre"
                type="text"
                required
                value={vincularForm.nombre}
                onChange={(e) => setVincularForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="v-rol" className="mb-1 block text-sm font-medium text-gray-700">
                  Rol
                </label>
                <select
                  id="v-rol"
                  value={vincularForm.rol}
                  onChange={(e) => setVincularForm((f) => ({ ...f, rol: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES_VINCULABLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="v-tenant" className="mb-1 block text-sm font-medium text-gray-700">
                  Tenant *
                </label>
                <select
                  id="v-tenant"
                  required
                  value={vincularForm.tenant_id}
                  onChange={(e) => setVincularForm((f) => ({ ...f, tenant_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {vincularError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {vincularError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVincularAbierto(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={vincularLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {vincularLoading ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: detalle de usuario ───────────────────────────────────── */}
      {detalle && (
        <Modal title={detalle.nombre ?? 'Usuario'} onClose={() => setDetalle(null)} maxWidth="max-w-2xl">
          {detalleLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/2 rounded bg-gray-100" />
              <div className="h-24 w-full rounded bg-gray-100" />
            </div>
          ) : detalleError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {detalleError}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">{detalle.email}</p>
                  {detalle.purgado_en ? (
                    <Badge color="border-gray-300 bg-gray-100 text-gray-600">
                      Purgada {fechaCorta(detalle.purgado_en)}
                    </Badge>
                  ) : detalle.activo ? (
                    <Badge color="border-green-200 bg-green-100 text-green-700">Activo</Badge>
                  ) : (
                    <Badge color="border-red-200 bg-red-100 text-red-700">
                      Desactivado {fechaCorta(detalle.desactivado_en)}
                    </Badge>
                  )}
                </div>
                {!detalle.purgado_en && (
                  <div className="flex gap-2">
                    {detalle.activo && (
                      <button
                        type="button"
                        onClick={() => setConfirmarDesactivar(detalle)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Desactivar cuenta
                      </button>
                    )}
                    {!detalle.activo && diasDesde(detalle.desactivado_en) >= 30 && (
                      <button
                        type="button"
                        onClick={() => setConfirmarPurgar(detalle)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                      >
                        Purgar
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Tenants</h4>
                  {!detalle.purgado_en && (
                    <button
                      type="button"
                      onClick={() => abrirVincular(detalle.email)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      + Vincular a otro tenant
                    </button>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2 font-medium">Tenant</th>
                        <th className="px-3 py-2 font-medium">Rol</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalle.tenants?.map((m) => (
                        <tr key={m.ut_id}>
                          <td className="px-3 py-2 text-gray-700">{m.tenant_nombre}</td>
                          <td className="px-3 py-2 text-gray-700">{m.rol}</td>
                          <td className="px-3 py-2">
                            {m.activo ? (
                              <Badge color="border-green-200 bg-green-100 text-green-700">Activo</Badge>
                            ) : (
                              <Badge color="border-gray-300 bg-gray-100 text-gray-600">Desvinculado</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {m.activo && (
                              <button
                                type="button"
                                disabled={desvincularLoadingId === m.tenant_id}
                                onClick={() => desvincular(detalle.id, m.tenant_id)}
                                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {desvincularLoadingId === m.tenant_id ? 'Desvinculando...' : 'Desvincular'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(!detalle.tenants || detalle.tenants.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                            Sin membresías.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Confirmar desactivar ────────────────────────────────────────── */}
      {confirmarDesactivar && (
        <Modal title="Desactivar cuenta" onClose={() => setConfirmarDesactivar(null)} maxWidth="max-w-md">
          <p className="mb-3 text-sm text-gray-600">
            Esto bloquea el login de{' '}
            <span className="font-semibold text-gray-900">{confirmarDesactivar.email}</span>, lo
            desvincula de todos sus tenants y <strong>cancela todas sus reservas activas y
            solicitudes pendientes</strong>. Es reversible (no se borra nada), pero afecta reservas
            reales de inmediato.
          </p>
          <p className="mb-1 text-sm text-gray-600">
            Escribe el email para confirmar:
          </p>
          <ConfirmarPorTexto
            esperado={confirmarDesactivar.email}
            error={desactivarError}
            loading={desactivarLoading}
            onCancelar={() => setConfirmarDesactivar(null)}
            onConfirmar={desactivar}
            textoBoton="Desactivar cuenta"
            textoBotonLoading="Desactivando..."
          />
        </Modal>
      )}

      {/* ── Confirmar purgar ────────────────────────────────────────────── */}
      {confirmarPurgar && (
        <Modal title="Purgar cuenta" onClose={() => setConfirmarPurgar(null)} maxWidth="max-w-md">
          <p className="mb-3 text-sm text-gray-600">
            Esto borra permanentemente el nombre, apellido, teléfono y contraseña de{' '}
            <span className="font-semibold text-gray-900">{confirmarPurgar.email}</span>, y libera
            su email. <strong>Es irreversible.</strong>
          </p>
          <p className="mb-1 text-sm text-gray-600">
            Escribe <span className="font-mono font-semibold">PURGAR</span> para confirmar:
          </p>
          <ConfirmarPorTexto
            esperado="PURGAR"
            error={purgarError}
            loading={purgarLoading}
            onCancelar={() => setConfirmarPurgar(null)}
            onConfirmar={purgar}
            textoBoton="Purgar cuenta"
            textoBotonLoading="Purgando..."
          />
        </Modal>
      )}
    </div>
  )
}

function ConfirmarPorTexto({ esperado, error, loading, onCancelar, onConfirmar, textoBoton, textoBotonLoading }) {
  const [texto, setTexto] = useState('')
  const habilitado = texto === esperado

  return (
    <div>
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition focus:ring-2 focus:ring-red-500"
      />
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!habilitado || loading}
          onClick={onConfirmar}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? textoBotonLoading : textoBoton}
        </button>
      </div>
    </div>
  )
}
