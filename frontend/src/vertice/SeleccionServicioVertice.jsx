import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { Chip, Button } from '../design-system'
import { ServiceCard } from '../design-system/components/ServiceCard'

export function SeleccionServicioVertice() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()

  const [servicios, setServicios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('Todos')

  useEffect(() => {
    const fetchServicios = async () => {
      try {
        setLoading(true)
        const { data, error: fetchErr } = await client.GET(
          '/api/v2/{tenant_slug}/servicios',
          {
            params: { path: { tenant_slug: tenantSlug } },
          }
        )
        if (fetchErr) throw fetchErr
        setServicios(data || [])
        setError(null)
      } catch (err) {
        setError(err.message || 'Error al cargar servicios')
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug) {
      fetchServicios()
    }
  }, [tenantSlug])

  const serviciosFiltrados = servicios.filter((s) => {
    if (filtro === 'Individual') return s.tipo === 'individual'
    if (filtro === 'Grupal') return s.tipo === 'grupal'
    if (filtro === 'Recurrente') return s.tipo === 'recurrente'
    return true
  })

  const handleReservar = (servicioId) => {
    navigate(`/t/${tenantSlug}/reservar/${servicioId}`)
  }

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
            marginBottom: 'var(--space-3)',
            letterSpacing: 'var(--track-h1)',
          }}
        >
          ¿Qué servicio necesitas?
        </h1>
        <p
          style={{
            fontSize: 'var(--text-body-sm)',
            color: 'var(--color-text-muted)',
            margin: 0,
          }}
        >
          Elige uno para ver los horarios disponibles.
        </p>
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
            <p style={{ fontSize: 'var(--text-body)' }}>Cargando servicios...</p>
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
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        ) : servicios.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12)',
              color: 'var(--color-text-muted)',
            }}
          >
            <p style={{ fontSize: 'var(--text-body)' }}>
              No hay servicios disponibles en este momento.
            </p>
          </div>
        ) : (
          <div>
            {/* Filtros */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)',
              }}
            >
              {['Todos', 'Individual', 'Grupal', 'Recurrente'].map((f) => (
                <Chip
                  key={f}
                  selected={filtro === f}
                  onClick={() => setFiltro(f)}
                >
                  {f}
                </Chip>
              ))}
            </div>

            {/* Grid de servicios */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--space-6)',
              }}
            >
              {serviciosFiltrados.map((servicio) => (
                <ServiceCard
                  key={servicio.id}
                  nombre={servicio.nombre}
                  descripcion={servicio.descripcion}
                  precio={servicio.precio}
                  tipo={servicio.tipo}
                  modalidad={servicio.modalidad}
                  duracion={servicio.duracion_minutos}
                  sesionesConfirmadas={servicio.sesiones_confirmadas || 0}
                  cupo={servicio.cupo || 10}
                  onReservar={() => handleReservar(servicio.id)}
                />
              ))}
            </div>

            {serviciosFiltrados.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-12)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <p>No hay servicios que coincidan con el filtro seleccionado.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
