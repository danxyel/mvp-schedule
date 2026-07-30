import { useState } from 'react'
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad'
import FlujReserva from './components/FlujReserva'
import MisReservas from './components/MisReservas'
import DetalleReserva from './components/DetalleReserva'

const NAV = [
  { key: 'calendario', label: 'Calendario' },
  { key: 'mis-reservas', label: 'Mis Reservas' },
]

function App() {
  const [vista, setVista] = useState('calendario')
  const [slotSeleccionado, setSlotSeleccionado] = useState(null)
  const [folioSeleccionado, setFolioSeleccionado] = useState(null)

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
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
            token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzg1NDUyMDc1LCJleHAiOjE3ODU1Mzg0NzV9.sAHXL4ZZXfZLegoKCIx8PJwGxVCuisijDGE37AX8lhc"
            onVerDetalle={handleVerDetalle}
          />
        ) : vista === 'detalle' && folioSeleccionado ? (
          <DetalleReserva
            tenantSlug="simal"
            folio={folioSeleccionado}
            token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzg1NDUyMDc1LCJleHAiOjE3ODU1Mzg0NzV9.sAHXL4ZZXfZLegoKCIx8PJwGxVCuisijDGE37AX8lhc"
            onVolver={handleVolverDeDetalle}
            onCancelada={handleVolverDeDetalle}
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
