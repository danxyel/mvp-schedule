import { useState, useEffect } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import { errorMensaje } from '../../utils/errores'
const CAMPO = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500'

export default function ConfigSmtpModal({ tenant, token, onClose, onGuardado }) {
  const [form, setForm] = useState({
    metodo: 'smtp',
    host: '',
    port: '587',
    user: '',
    password: '',
    from_email: '',
    from_name: '',
    tls: true,
    ssl: false,
    console: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }))

  useEffect(() => {
    if (!tenant) return
    const cfg = tenant.smtp_config ?? {}
    setForm({
      metodo: cfg.metodo ?? 'smtp',
      host: cfg.host ?? '',
      port: cfg.port != null ? String(cfg.port) : '587',
      user: cfg.user ?? '',
      password: '',
      from_email: cfg.from_email ?? '',
      from_name: cfg.from_name ?? '',
      tls: cfg.tls ?? true,
      ssl: cfg.ssl ?? false,
      console: cfg.console ?? false,
    })
  }, [tenant])

  const guardar = async (e) => {
    e.preventDefault()
    if (loading) return

    const smtp_config = { metodo: form.metodo }
    if (form.host.trim()) smtp_config.host = form.host.trim()
    if (form.port.trim()) smtp_config.port = Number(form.port)
    if (form.user.trim()) smtp_config.user = form.user.trim()
    if (form.password) smtp_config.password = form.password
    if (form.from_email.trim()) smtp_config.from_email = form.from_email.trim()
    if (form.from_name.trim()) smtp_config.from_name = form.from_name.trim()
    smtp_config.tls = form.tls
    smtp_config.ssl = form.ssl
    smtp_config.console = form.console

    if (form.metodo === 'smtp' && !smtp_config.host) {
      setError('El host es obligatorio para configurar el email por SMTP')
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.PATCH(
      '/api/v2/superadmin/tenants/{tenant_id}',
      {
        params: { path: { tenant_id: tenant.id } },
        body: { smtp_config },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setLoading(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr) ?? 'No se pudo guardar la configuración')
      return
    }
    onGuardado(data)
    onClose()
  }

  return (
    <Modal title={`Configuración de email — ${tenant.nombre}`} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="smtp-metodo" className="mb-1 block text-sm font-medium text-gray-700">
            Método de envío
          </label>
          <select
            id="smtp-metodo"
            value={form.metodo}
            onChange={(e) => set('metodo', e.target.value)}
            className={CAMPO}
          >
            <option value="smtp">SMTP propio</option>
            <option value="api">API centralizada (Resend) — pruebas</option>
          </select>
          {form.metodo === 'api' && (
            <p className="mt-1 text-xs text-gray-500">
              En modo API los correos salen por la cuenta Resend de Daniel. El tenant sigue
              apareciendo como remitente y el Reply-To apunta a su correo configurado.
            </p>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${form.metodo === 'api' ? 'opacity-60' : ''}`}>
          <div>
            <label htmlFor="smtp-host" className="mb-1 block text-sm font-medium text-gray-700">
              Servidor SMTP (host) {form.metodo === 'smtp' && <span className="text-red-500">*</span>}
            </label>
            <input
              id="smtp-host"
              type="text"
              required={form.metodo === 'smtp'}
              disabled={form.metodo === 'api'}
              value={form.host}
              onChange={(e) => set('host', e.target.value)}
              className={CAMPO}
              placeholder="smtp.tu-proveedor.com"
            />
          </div>
          <div>
            <label htmlFor="smtp-port" className="mb-1 block text-sm font-medium text-gray-700">
              Puerto
            </label>
            <input
              id="smtp-port"
              type="number"
              min="1"
              max="65535"
              disabled={form.metodo === 'api'}
              value={form.port}
              onChange={(e) => set('port', e.target.value)}
              className={CAMPO}
              placeholder="587"
            />
          </div>
          <div>
            <label htmlFor="smtp-user" className="mb-1 block text-sm font-medium text-gray-700">
              Usuario
            </label>
            <input
              id="smtp-user"
              type="text"
              disabled={form.metodo === 'api'}
              value={form.user}
              onChange={(e) => set('user', e.target.value)}
              className={CAMPO}
              placeholder="cuenta@smtp.proveedor.com"
            />
          </div>
          <div>
            <label htmlFor="smtp-password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="smtp-password"
              type="password"
              autoComplete="new-password"
              disabled={form.metodo === 'api'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              className={CAMPO}
              placeholder="Dejar vacío para no cambiar la contraseña guardada"
            />
          </div>
          <div>
            <label htmlFor="smtp-from-email" className="mb-1 block text-sm font-medium text-gray-700">
              Correo remitente (from_email)
            </label>
            <input
              id="smtp-from-email"
              type="email"
              value={form.from_email}
              onChange={(e) => set('from_email', e.target.value)}
              className={CAMPO}
              placeholder="no-reply@tu-dominio.com"
            />
          </div>
          <div>
            <label htmlFor="smtp-from-name" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre remitente (from_name)
            </label>
            <input
              id="smtp-from-name"
              type="text"
              value={form.from_name}
              onChange={(e) => set('from_name', e.target.value)}
              className={CAMPO}
              placeholder="Nombre de tu negocio"
            />
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 ${form.metodo === 'api' ? 'opacity-60' : ''}`}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              disabled={form.metodo === 'api'}
              checked={form.tls}
              onChange={(e) => set('tls', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Usar TLS (STARTTLS, puerto 587)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              disabled={form.metodo === 'api'}
              checked={form.ssl}
              onChange={(e) => set('ssl', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Usar SSL (puerto 465)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.console}
              onChange={(e) => set('console', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Modo prueba
          </label>
          <p className="pl-6 text-xs text-gray-500">
            Modo prueba: solo registra el correo en los logs del backend, no lo envía de verdad.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
