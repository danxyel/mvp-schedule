import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Reclamar from './components/Reclamar'
import Activar from './components/Activar'
import RecuperarPassword from './components/RecuperarPassword'
import RestablecerPassword from './components/RestablecerPassword'
import ResponderEncuesta from './components/ResponderEncuesta'
import SeleccionServicio from './components/SeleccionServicio'
import SeleccionTenant from './components/SeleccionTenant'
import CalendarioDisponibilidad from './components/CalendarioDisponibilidad'
import SesionesAbiertas from './components/SesionesAbiertas'
import FlujReserva from './components/FlujReserva'
import SolicitarFecha from './components/SolicitarFecha'
import MisReservas from './components/MisReservas'
import MisSolicitudes from './components/MisSolicitudes'
import MisSeries from './components/MisSeries'
import DetalleReserva from './components/DetalleReserva'
import DetalleReservaPublica from './components/DetalleReservaPublica'
import PanelAdmin from './components/admin/PanelAdmin'
import GestionTenants from './components/superadmin/GestionTenants'
import GestionUsuariosGlobal from './components/superadmin/GestionUsuariosGlobal'
import ProtectedRoute from './components/ProtectedRoute'
import TenantThemeProvider from './components/TenantThemeProvider'
import {
  TestPage,
  SeleccionServicioVertice,
  BookingFlowDynamic,
  ConfirmationScreenDynamic,
  MyReservationsDynamic,
  ReservationDetailDynamic,
  CheckoutDynamic,
} from './vertice'

function App() {
  return (
    <BrowserRouter>
      <TenantThemeProvider>
        <Routes>
        {/* Rutas públicas */}
        <Route path="/test/vertice" element={<TestPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/recuperar-password/confirmar" element={<RestablecerPassword />} />
        <Route path="/encuestas/responder" element={<ResponderEncuesta />} />

        {/* Ruta pública: detalle de reserva por folio + código */}
        <Route path="/t/:tenantSlug/r/:folio" element={<DetalleReservaPublica />} />
        
        {/* Rutas públicas del tenant (sin login) — Vértice */}
        <Route path="/t/:tenantSlug" element={<SeleccionServicioVertice />} />
        <Route path="/t/:tenantSlug/reservar/:servicioId" element={<BookingFlowDynamic />} />

        {/* Rutas antiguas (fallback) */}
        <Route path="/t/:tenantSlug/servicio/:servicioId" element={<CalendarioDisponibilidad />} />
        <Route path="/t/:tenantSlug/servicio/:servicioId/sesiones-abiertas" element={<SesionesAbiertas />} />
        <Route path="/t/:tenantSlug/reclamar" element={<Reclamar />} />
        <Route path="/t/:tenantSlug/activar" element={<Activar />} />
        <Route
          path="/t/:tenantSlug/solicitar/:servicioId"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <SolicitarFecha />
            </ProtectedRoute>
          }
        />

        {/* Rutas de confirmación (Vértice) */}
        <Route
          path="/t/:tenantSlug/confirmar/:codigo"
          element={<ConfirmationScreenDynamic />}
        />
        <Route
          path="/t/:tenantSlug/checkout/:folio"
          element={<CheckoutDynamic />}
        />

        {/* Rutas protegidas */}
        <Route
          path="/mis-reservas"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <MyReservationsDynamic />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/mis-reservas/:folio"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <ReservationDetailDynamic />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mis-series"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <MisSeries />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mis-solicitudes"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <MisSolicitudes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'asesor', 'superadmin']}>
              <PanelAdmin />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <GestionTenants />
            </ProtectedRoute>
          }
        />

        <Route
          path="/superadmin/usuarios"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <GestionUsuariosGlobal />
            </ProtectedRoute>
          }
        />

        <Route
          path="/seleccion-tenant"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <SeleccionTenant />
            </ProtectedRoute>
          }
        />

        {/* Ruta por defecto */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Ruta catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </TenantThemeProvider>
    </BrowserRouter>
  )
}

export default App
