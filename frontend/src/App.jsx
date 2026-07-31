import { useState } from 'react'
import Login from './components/Login'
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad'
import FlujReserva from './components/FlujReserva'
import MisReservas from './components/MisReservas'
import DetalleReserva from './components/DetalleReserva'
import PanelAdmin from './components/admin/PanelAdmin'

const NAV = [
  { key: 'calendario', label: 'Calendario' },
  { key: 'mis-reservas', label: 'Mis Reservas' },
  { key: 'admin', label: 'Admin' },
]

function App() {
  const [token, setToken] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('calendario')
  const [slotSeleccionado, setSlotSeleccionado] = useState(null)
  const [folioSeleccionado, setFolioSeleccionado] = useState(null)

  const handleLogin = (nuevoToken, nuevoUsuario) => {
    setToken(nuevoToken)
    setUsuario(nuevoUsuario)
    setSlotSeleccionado(null)
    setFolioSeleccionado(null)
    setVista('calendario')
  }

  const handleLogout = () => {
    setToken(null)
    setUsuario(null)
    setSlotSeleccionado(null)
    setFolioSeleccionado(null)
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

  const handleVerDetalle = (folio) => {
    setFolioSeleccionado(folio)
    setVista('detalle')
  }

  const handleVolverDeDetalle = () => {
    setFolioSeleccionado(null)
    setVista('mis-reservas')
  }

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-bold text-gray-700">MVP Schedule</span>
          <div className="flex gap-1">
            {NAV.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSlotSeleccionado(null)
                  setVista(key)
                }}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
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
            <span className="text-sm text-gray-600">
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

      <main className="flex justify-center p-4">
        {vista === 'reserva' && slotSeleccionado ? (
          <FlujReserva
            tenantSlug="simal"
            servicioId={1}
            slot={slotSeleccionado}
            servicioNombre="Consultoría Individual"
            precio={1500}
            moneda="MXN"
            onVolver={handleVolver}
          />
        ) : vista === 'mis-reservas' ? (
          <MisReservas
            tenantSlug="simal"
            token={token}
            onVerDetalle={handleVerDetalle}
          />
        ) : vista === 'detalle' && folioSeleccionado ? (
          <DetalleReserva
            tenantSlug="simal"
            folio={folioSeleccionado}
            token={token}
            onVolver={handleVolverDeDetalle}
            onCancelada={handleVolverDeDetalle}
          />
        ) : vista === 'admin' ? (
          <PanelAdmin
            tenantSlug="simal"
            token={token}
            onVolver={handleVolver}
          />
        ) : (
          <CalendarioDisponibilidad
            tenantSlug="simal"
            servicioId={1}
            onSlotSelect={handleSlotSelect}
          />
        )}
      </main>
    </div>
  )
}

export default App
