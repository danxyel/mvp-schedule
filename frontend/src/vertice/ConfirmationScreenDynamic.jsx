import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
import { Button } from '../design-system'

export function ConfirmationScreenDynamic() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [reserva, setReserva] = useState(location.state?.reserva || null)
  const [loading, setLoading] = useState(!reserva)

  useEffect(() => {
    if (reserva) return

    const fetchReserva = async () => {
      try {
        const { data, error: fetchErr } = await client.GET(`/reservas/${codigo}`)
        if (fetchErr) throw fetchErr
        setReserva(data)
      } catch (err) {
        console.error('Error cargando reserva:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchReserva()
  }, [codigo, reserva])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        padding: 'var(--gutter-movil)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          animation: 'riseIn var(--dur-enter) var(--ease-out)',
          maxWidth: 500,
        }}
      >
        {loading ? (
          <p style={{ fontSize: 'var(--text-body)' }}>Confirmando tu reserva...</p>
        ) : (
          <>
            {/* Icono de éxito */}
            <div
              style={{
                fontSize: 60,
                marginBottom: 'var(--space-6)',
              }}
            >
              ✓
            </div>

            {/* Título */}
            <h1
              style={{
                fontSize: 'var(--text-display-sm)',
                fontWeight: 'var(--weight-bold)',
                margin: '0 0 var(--space-3) 0',
                color: 'var(--color-text)',
                letterSpacing: 'var(--track-display)',
              }}
            >
              Lugar asegurado
            </h1>

            {/* Descripción */}
            <p
              style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-muted)',
                margin: '0 0 var(--space-8) 0',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              Tu reserva ha sido confirmada. Recibirás un correo de confirmación en los próximos minutos.
            </p>

            {/* Detalles de la reserva */}
            {reserva && (
              <div
                style={{
                  border: 'var(--border-hairline)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-6)',
                  backgroundColor: 'var(--color-surface)',
                  marginBottom: 'var(--space-8)',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--track-eyebrow)',
                        margin: 0,
                      }}
                    >
                      Servicio
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-title)',
                        fontWeight: 'var(--weight-semibold)',
                        margin: 'var(--space-1) 0 0 0',
                      }}
                    >
                      {reserva.servicio_nombre}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--track-eyebrow)',
                        margin: 0,
                      }}
                    >
                      Fecha y Hora
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-title)',
                        fontWeight: 'var(--weight-semibold)',
                        margin: 'var(--space-1) 0 0 0',
                      }}
                    >
                      {new Date(reserva.fecha_hora_inicio).toLocaleDateString('es-MX', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      a las{' '}
                      {new Date(reserva.fecha_hora_inicio).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Código de reserva */}
            <div
              style={{
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)',
                backgroundColor: 'var(--color-surface)',
                marginBottom: 'var(--space-8)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--track-eyebrow)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Código de reserva
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--text-h2)',
                  fontWeight: 'var(--weight-bold)',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-accent)',
                  wordBreak: 'break-all',
                }}
              >
                {reserva?.codigo_reserva || codigo}
              </div>
            </div>

            {/* Acciones */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-4)',
                flexDirection: 'column',
              }}
            >
              <Button
                variant="ghost"
                onClick={() => navigate('/mis-reservas')}
                block
              >
                Ir a mis reservas
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                block
              >
                Volver al inicio
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
