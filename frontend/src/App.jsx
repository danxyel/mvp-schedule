import { useState } from 'react'
import Login from './components/Login'
import Registro from './components/Registro'
import SeleccionServicio from './components/SeleccionServicio'
import SeleccionTenant from './components/SeleccionTenant'
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad'
import FlujReserva from './components/FlujReserva'
import MisReservas from './components/MisReservas'
import DetalleReserva from './components/DetalleReserva'
import PanelAdmin from './components/admin/PanelAdmin'
import GestionTenants from './components/superadmin/GestionTenants'

function persistirSesion({ token, usuario, tenantSlug, tenantNombre }) {
  const guardar = (clave, valor) => {
    if (valor) sessionStorage.setItem(clave, valor)
    else sessionStorage.removeItem(clave)
  }
  guardar('token', token)
  guardar('usuario', usuario ? JSON.stringify(usuario) : null)
  guardar('tenantSlug', tenantSlug)
  guardar('tenantNombre', tenantNombre)
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || null)
  const [usuario, setUsuario] = useState(() => {
    const u = sessionStorage.getItem('usuario')
    return u ? JSON.parse(u) : null
  })
  const [tenantSlug, setTenantSlug] = useState(
    () => sessionStorage.getItem('tenantSlug') || null,
  )
  const [tenantNombre, setTenantNombre] = useState(
    () => sessionStorage.getItem('tenantNombre') || null,
  )
  const [vista, setVista] = useState(() => {
    const u = sessionStorage.getItem('usuario')
    const rol = u ? JSON.parse(u).rol : null
    if (rol === 'superadmin') return 'tenants'
    if (rol === 'admin' || rol === 'asesor') return 'panel-admin'
    if (rol === 'cliente' && !sessionStorage.getItem('tenantSlug')) return 'seleccion-tenant'
    return 'servicios'
  })
  const [mostrarRegistro, setMostrarRegistro] = useState(false)
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null)
  const [slotSeleccionado, setSlotSeleccionado] = useState(null)
  const [folioSeleccionado, setFolioSeleccionado] = useState(null)

  const handleLogin = (nuevoToken, nuevoUsuario) => {
    setToken(nuevoToken)
    setUsuario(nuevoUsuario)
    setTenantSlug(nuevoUsuario.tenant_slug)
    setTenantNombre(nuevoUsuario.tenant_nombre)
    setServicioSeleccionado(null)
    setSlotSeleccionado(null)
    setFolioSeleccionado(null)
    persistirSesion({
      token: nuevoToken,
      usuario: nuevoUsuario,
      tenantSlug: nuevoUsuario.tenant_slug,
      tenantNombre: nuevoUsuario.tenant_nombre,
    })
    if (nuevoUsuario.rol === 'superadmin') setVista('tenants')
    else if (nuevoUsuario.rol === 'admin' || nuevoUsuario.rol === 'asesor') setVista('panel-admin')
    else if (nuevoUsuario.rol === 'cliente' && !nuevoUsuario.tenant_slug) setVista('seleccion-tenant')
    else setVista('servicios')
  }

  const handleLogout = () => {
    setToken(null)
    setUsuario(null)
    setTenantSlug(null)
    setTenantNombre(null)
    setServicioSeleccionado(null)
    setSlotSeleccionado(null)
    setFolioSeleccionado(null)
    setVista('servicios')
    persistirSesion({ token: null, usuario: null, tenantSlug: null, tenantNombre: null })
  }

  const handleEntrarTenant = (slug, nombre) => {
    setTenantSlug(slug)
    setTenantNombre(nombre)
    persistirSesion({ token, usuario, tenantSlug: slug, tenantNombre: nombre })
    setServicioSeleccionado(null)
    setSlotSeleccionado(null)
    setVista('panel-admin')
  }

  const handleElegirTenant = (slug, nombre) => {
    setTenantSlug(slug)
    setTenantNombre(nombre)
    persistirSesion({ token, usuario, tenantSlug: slug, tenantNombre: nombre })
    setServicioSeleccionado(null)
    setSlotSeleccionado(null)
    setVista('servicios')
  }

  const handleSeleccionarServicio = (servicio) => {
    setServicioSeleccionado(servicio)
    setSlotSeleccionado(null)
    setVista('calendario')
  }

  const handleSlotSelect = (slot) => {
    setSlotSeleccionado(slot)
    setVista('reserva')
  }

  const handleVolver = () => {
    setSlotSeleccionado(null)
    setVista('calendario')
  }

  const handleVolverDePanel = () => {
    setVista(usuario?.rol === 'superadmin' ? 'tenants' : 'calendario')
  }

  const handleVerDetalle = (folio) => {
    setFolioSeleccionado(folio)
    setVista('detalle')
  }

  const handleVolverDeDetalle = () => {
    setFolioSeleccionado(null)
    setVista('mis-reservas')
  }

  const handleNav = (key) => {
    setSlotSeleccionado(null)
    if (key === 'servicios') setServicioSeleccionado(null)
    if (key === 'calendario' && !servicioSeleccionado) setVista('servicios')
    else setVista(key)
  }

  if (!token) {
    if (mostrarRegistro) {
      return <Registro onRegistro={handleLogin} onVolverALogin={() => setMostrarRegistro(false)} />
    }
    return <Login onLogin={handleLogin} onIrARegistro={() => setMostrarRegistro(true)} />
  }

  let brand = 'MVP Schedule'
  if (usuario?.rol === 'superadmin') {
    if (vista === 'panel-admin' && tenantNombre) brand = `${tenantNombre}. Admin`
  } else if (tenantNombre) {
    brand = tenantNombre
  }

  let navItems = []
  if (usuario?.rol === 'superadmin') {
    if (vista !== 'tenants') navItems = [{ key: 'tenants', label: '← Tenants' }]
  } else if (usuario?.rol === 'admin' || usuario?.rol === 'asesor') {
    navItems = [
      { key: 'panel-admin', label: 'Panel' },
      { key: 'calendario', label: 'Calendario' },
    ]
  } else if (vista === 'seleccion-tenant') {
    navItems = []
  } else {
    navItems = [
      { key: 'servicios', label: '← Servicios' },
      { key: 'calendario', label: 'Calendario' },
      { key: 'mis-reservas', label: 'Mis Reservas' },
    ]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <span className="truncate text-sm font-bold text-gray-700">{brand}</span>
          <div className="flex flex-wrap items-center gap-1">
            {navItems.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleNav(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
                  vista === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 sm:hidden">
              {usuario?.nombre?.trim().charAt(0).toUpperCase() ?? 'U'}
            </span>
            <span className="hidden truncate text-sm text-gray-600 sm:inline">
              {usuario?.nombre ?? 'Usuario'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-w-0 justify-center p-4">
        {vista === 'reserva' && slotSeleccionado && servicioSeleccionado ? (
          <FlujReserva
            tenantSlug={tenantSlug}
            token={token}
            servicioId={servicioSeleccionado.id}
            slot={slotSeleccionado}
            servicioNombre={servicioSeleccionado.nombre}
            precio={servicioSeleccionado.precio}
            moneda={servicioSeleccionado.moneda}
            onVolver={handleVolver}
          />
        ) : vista === 'mis-reservas' ? (
          <MisReservas
            tenantSlug={tenantSlug}
            token={token}
            onVerDetalle={handleVerDetalle}
          />
        ) : vista === 'detalle' && folioSeleccionado ? (
          <DetalleReserva
            tenantSlug={tenantSlug}
            folio={folioSeleccionado}
            token={token}
            onVolver={handleVolverDeDetalle}
            onCancelada={handleVolverDeDetalle}
          />
        ) : vista === 'panel-admin' && tenantSlug ? (
          <PanelAdmin
            tenantSlug={tenantSlug}
            token={token}
            onVolver={handleVolverDePanel}
          />
        ) : vista === 'panel-admin' || vista === 'tenants' ? (
          <GestionTenants token={token} onEntrarTenant={handleEntrarTenant} />
        ) : vista === 'seleccion-tenant' ? (
          <SeleccionTenant onSeleccionar={handleElegirTenant} />
        ) : vista === 'servicios' || (vista === 'calendario' && !servicioSeleccionado) ? (
          <SeleccionServicio tenantSlug={tenantSlug} onSeleccionar={handleSeleccionarServicio} />
        ) : (
          <CalendarioDisponibilidad
            tenantSlug={tenantSlug}
            servicioId={servicioSeleccionado.id}
            onSlotSelect={handleSlotSelect}
          />
        )}
      </main>
    </div>
  )
}

export default App
