import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
import { Button } from '../design-system'

export function CheckoutDynamic() {
  const { tenantSlug, folio } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const token = sessionStorage.getItem('acceso_token') || sessionStorage.getItem('token')

  // Si ya tenemos los datos de reserva del estado de navegación, úsalos
  const [reserva, setReserva] = useState(location.state?.reserva || null)
  const [loading, setLoading] = useState(!reserva)
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (reserva) {
      // Ya tenemos los datos de la reserva del estado de navegación
      console.log('Usando datos de reserva del estado:', reserva)
      setLoading(false)
      return
    }

    // Si no tenemos la reserva, mostrar error
    // (debería siempre venir del estado de navegación)
    console.error('No hay datos de reserva. Deberías navegar desde BookingFlowDynamic o ConfirmationScreenDynamic')
    setError('No se encontraron datos de la reserva. Por favor intenta desde el flujo de reserva.')
    setLoading(false)
  }, [reserva])

  const handleProcesarPago = async () => {
    setProcesando(true)
    try {
      console.log('Iniciando checkout para folio:', folio)
      console.log('¿Tiene token?:', !!token)
      console.log('Token primeros 50 chars:', token ? token.substring(0, 50) + '...' : 'NO TOKEN')

      const { data: checkout, error: checkoutErr } = await client.POST(
        '/api/v2/{tenant_slug}/reservas/{folio}/checkout',
        {
          params: {
            path: { tenant_slug: tenantSlug, folio },
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )

      console.log('Respuesta checkout:', checkout)
      console.log('Error checkout:', checkoutErr)

      if (checkoutErr) throw checkoutErr
      if (checkout?.url) {
        console.log('Redirigiendo a:', checkout.url)
        window.location.href = checkout.url
      } else {
        console.log('No se recibió URL de pago')
        setError('No se pudo obtener URL de pago')
      }
    } catch (err) {
      console.error('Error al procesar pago:', err)
      setError('No se pudo procesar el pago')
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
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
        }}
      >
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
          Cargando detalles del pago...
        </p>
      </div>
    )
  }

  if (error) {
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
        }}
      >
        <div
          style={{
            maxWidth: 500,
            animation: 'riseIn var(--dur-enter) var(--ease-out)',
          }}
        >
          <div
            style={{
              fontSize: 60,
              marginBottom: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: 'var(--text-display-sm)',
              fontWeight: 'var(--weight-bold)',
              margin: '0 0 var(--space-3) 0',
              color: 'var(--color-text)',
              textAlign: 'center',
            }}
          >
            Error al procesar
          </h1>

          <p
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              margin: '0 0 var(--space-8) 0',
              lineHeight: 'var(--leading-normal)',
              textAlign: 'center',
            }}
          >
            {error}
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
            }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate('/mis-reservas')}
              block
            >
              Ir a reservas
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!reserva) {
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
        }}
      >
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
          No se encontró la reserva
        </p>
      </div>
    )
  }

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
      }}
    >
      <div
        style={{
          maxWidth: 500,
          animation: 'riseIn var(--dur-enter) var(--ease-out)',
        }}
      >
        {/* Título */}
        <h1
          style={{
            fontSize: 'var(--text-display-sm)',
            fontWeight: 'var(--weight-bold)',
            margin: '0 0 var(--space-3) 0',
            color: 'var(--color-text)',
            textAlign: 'center',
          }}
        >
          Procesa tu pago
        </h1>

        {/* Descripción */}
        <p
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-8) 0',
            lineHeight: 'var(--leading-normal)',
            textAlign: 'center',
          }}
        >
          Por favor completa el pago para confirmar tu reserva.
        </p>

        {/* Resumen de la reserva */}
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
            {/* Servicio */}
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

            {/* Fecha y Hora */}
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

            {/* Monto a pagar */}
            {reserva.precio_final && (
              <div
                style={{
                  paddingTop: 'var(--space-4)',
                  borderTop: 'var(--border-hairline)',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--track-eyebrow)',
                    margin: '0 0 var(--space-2) 0',
                  }}
                >
                  Monto a pagar
                </p>
                <div
                  style={{
                    fontSize: 'var(--text-h2)',
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--color-accent)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {reserva.moneda === 'MXN' ? '$' : ''}
                  {new Intl.NumberFormat('es-MX').format(reserva.precio_final)}{' '}
                  <span
                    style={{
                      fontSize: 'var(--text-body)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {reserva.moneda}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

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
              fontSize: 'var(--text-h3)',
              fontWeight: 'var(--weight-bold)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-accent)',
              wordBreak: 'break-all',
            }}
          >
            {reserva.codigo_confirmacion}
          </div>
        </div>

        {/* Botones de acción */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            flexDirection: 'column',
          }}
        >
          <Button
            onClick={handleProcesarPago}
            loading={procesando}
            block
          >
            Procesar pago
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/mis-reservas')}
            block
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
