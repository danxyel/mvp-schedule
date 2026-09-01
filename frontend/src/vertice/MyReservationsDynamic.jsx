import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { BookingRow, Button } from '../design-system'

export function MyReservationsDynamic() {
  const navigate = useNavigate()
  const [reservas, setReservas] = useState([])
  const [filtro, setFiltro] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchReservas = async () => {
      try {
        setLoading(true)
        const { data } = await client.GET('/api/v1/mis-reservas')
        setReservas(data || [])
        setError(null)
      } catch (err) {
        setError(err.message || 'Error al cargar reservas')
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchReservas()
  }, [])

  const filtrarReservas = () => {
    const ahora = new Date()
    return reservas.filter((r) => {
      if (filtro === 'Próximas') return new Date(r.fecha_inicio) > ahora
      if (filtro === 'Pasadas') return new Date(r.fecha_inicio) <= ahora
      return true
    })
  }

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo)
  }

  const abrirDetalles = (folio) => {
    navigate(`/mis-reservas/${folio}`)
  }

  const reservasFiltradas = filtrarReservas()

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: 'var(--border-hairline)',
          padding: 'var(--gutter-movil)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-h1-sm)',
            fontWeight: 'var(--weight-semibold)',
            margin: 0,
            letterSpacing: 'var(--track-h1)',
          }}
        >
          Mis reservas
        </h1>
      </div>

      {/* Contenido */}
      <div
        style={{
          maxWidth: 'var(--width-content)',
          width: '100%',
          margin: '0 auto',
          padding: 'var(--gutter-movil)',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <p style={{ fontSize: 'var(--text-body)' }}>Cargando reservas...</p>
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12)',
              color: 'var(--color-warn)',
            }}
          >
            <p style={{ fontSize: 'var(--text-body)' }}>Error: {error}</p>
          </div>
        ) : reservas.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12) var(--gutter-movil)',
              color: 'var(--color-text-muted)',
            }}
          >
            <p style={{ fontSize: 'var(--text-body)', margin: 0 }}>No tienes reservas aún.</p>
            <Button
              variant="primary"
              style={{ marginTop: 'var(--space-6)' }}
              onClick={() => navigate('/t/tu-tenant')}
            >
              Hacer una reserva
            </Button>
          </div>
        ) : (
          <div>
            {/* Filtros */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
                flexWrap: 'wrap',
              }}
            >
              {['Todas', 'Próximas', 'Pasadas'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor:
                      filtro === f ? 'var(--color-accent)' : 'transparent',
                    color: filtro === f ? 'white' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-body-sm)',
                    fontFamily: 'var(--font-body)',
                    transition: 'all var(--dur-fast)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Listado */}
            <div
              style={{
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-2xl)',
                backgroundColor: 'var(--color-surface)',
                overflow: 'hidden',
              }}
            >
              {reservasFiltradas.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    padding: 'var(--gutter-movil)',
                    borderBottom:
                      idx < reservasFiltradas.length - 1
                        ? 'var(--border-hairline)'
                        : 'none',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast) var(--ease-out)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      'var(--color-neutral-100)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <BookingRow
                    hora={new Date(r.fecha_inicio).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    dia={new Date(r.fecha_inicio).toLocaleDateString('es-MX')}
                    titulo={r.servicio_nombre}
                    lugar={r.modalidad === 'virtual' ? 'Online' : r.lugar}
                    estado={r.estado}
                    tone={
                      r.estado === 'confirmada'
                        ? 'positive'
                        : r.estado === 'pendiente'
                          ? 'warn'
                          : 'idle'
                    }
                    codigo={r.codigo_reserva}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--color-text-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{r.codigo_reserva}</span>
                    <button
                      type="button"
                      onClick={() => copiarCodigo(r.codigo_reserva)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Copiar código
                    </button>
                    <span style={{ marginLeft: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => abrirDetalles(r.folio)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-accent)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-body-sm)',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Ver detalles →
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
