import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { Button } from '../design-system'

const MODALIDAD_ICON = {
  presencial: '📍',
  virtual: '💻',
  hibrida: '🔄',
}

function toLocalTime(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(utcString))
}

function CountdownTimer({ expiraEn }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiraEn) return

    function tick() {
      const diff = new Date(expiraEn) - new Date()
      setRemaining(Math.max(0, diff))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraEn])

  if (remaining === null) return null
  if (remaining <= 0) return (
    <span style={{
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-error)',
    }}>
      Tiempo agotado
    </span>
  )

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        border: 'var(--border-hairline)',
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-warning-light)',
        textAlign: 'center',
      }}
    >
      <p style={{
        fontSize: 'var(--text-caption)',
        color: 'var(--color-warning)',
        margin: '0 0 var(--space-2) 0',
      }}>
        Tiempo restante para pagar:
      </p>
      <span style={{
        fontFamily: 'monospace',
        fontSize: 'var(--text-h3)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-warning-dark)',
      }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}

function EstadoBadge({ estado }) {
  const estadoColores = {
    pendiente: { bg: 'var(--color-warning-light)', text: 'var(--color-warning-dark)', label: 'Pendiente' },
    en_espera: { bg: 'var(--color-info-light)', text: 'var(--color-info-dark)', label: 'En espera' },
    confirmada: { bg: 'var(--color-success-light)', text: 'var(--color-success-dark)', label: 'Confirmada' },
    cancelada: { bg: 'var(--color-error-light)', text: 'var(--color-error-dark)', label: 'Cancelada' },
    completada: { bg: 'var(--color-success-light)', text: 'var(--color-success-dark)', label: 'Completada' },
  }

  const color = estadoColores[estado] || { bg: 'var(--color-surface)', text: 'var(--color-text-muted)', label: estado }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-full)',
        backgroundColor: color.bg,
        color: color.text,
        fontSize: 'var(--text-caption)',
        fontWeight: 'var(--weight-semibold)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--track-eyebrow)',
      }}
    >
      {color.label}
    </div>
  )
}

function ReservationDetailSkeleton() {
  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: 'var(--gutter-movil)',
    }}>
      <div style={{
        height: 24,
        width: 80,
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-surface-2)',
        marginBottom: 'var(--space-6)',
        animation: 'pulse 2s infinite',
      }} />
      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: 'var(--border-hairline)',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-surface)',
        animation: 'pulse 2s infinite',
      }}>
        <div style={{
          height: 28,
          width: '60%',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-2)',
          marginBottom: 'var(--space-4)',
        }} />
        <div style={{ space: 'var(--space-3)' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 16,
                width: `${60 + Math.random() * 20}%`,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-2)',
                marginBottom: 'var(--space-3)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const ESTADOS_CANCELABLES = ['pendiente', 'en_espera', 'confirmada']

export function ReservationDetailDynamic() {
  const { folio } = useParams()
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [pagarLoading, setPagarLoading] = useState(false)
  const [pagarError, setPagarError] = useState(null)

  const tenantSlug = sessionStorage.getItem('tenantSlug')

  const fetchReserva = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/reservas/{folio}',
        {
          params: { path: { tenant_slug: tenantSlug, folio } },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (fetchErr) {
        setError(fetchErr)
        return
      }
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, folio, token])

  useEffect(() => {
    fetchReserva()
  }, [fetchReserva])

  const handleCancelar = async () => {
    setCancelando(true)
    setCancelError(null)
    try {
      const { error: cancelErr } = await client.POST(
        '/api/v2/{tenant_slug}/reservas/{folio}/cancelar',
        {
          params: { path: { tenant_slug: tenantSlug, folio } },
          headers: { Authorization: `Bearer ${token}` },
          body: { motivo: motivo || null },
        },
      )
      if (cancelErr) {
        setCancelError(cancelErr)
        return
      }
      setShowCancelModal(false)
      navigate('/mis-reservas')
    } catch (err) {
      setCancelError(err)
    } finally {
      setCancelando(false)
    }
  }

  const pagar = async () => {
    setPagarLoading(true)
    setPagarError(null)
    const { data: checkoutData, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/reservas/{folio}/checkout',
      {
        params: { path: { tenant_slug: tenantSlug, folio } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setPagarLoading(false)
    if (fetchErr || !checkoutData?.url) {
      setPagarError('No se pudo iniciar el pago')
      return
    }
    window.location.href = checkoutData.url
  }

  if (loading) {
    return <ReservationDetailSkeleton />
  }

  if (error) {
    return (
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: 'var(--gutter-movil)',
      }}>
        <button
          type="button"
          onClick={() => navigate('/mis-reservas')}
          style={{
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-body)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Volver
        </button>
        <div style={{
          borderRadius: 'var(--radius-xl)',
          border: 'var(--border-hairline)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-error-light)',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 'var(--text-title)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--color-error-dark)',
            margin: '0 0 var(--space-2) 0',
          }}>
            Error al cargar la reserva
          </p>
          <p style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-error)',
            margin: 'var(--space-2) 0 var(--space-4) 0',
          }}>
            {error?.message ?? JSON.stringify(error)}
          </p>
          <Button onClick={fetchReserva} variant="primary" block>
            Intentar de nuevo
          </Button>
        </div>
      </div>
    )
  }

  const r = data
  const esCancelable = ESTADOS_CANCELABLES.includes(r.estado)
  const puedeVerMeet = r.estado === 'confirmada' && r.meet_url

  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: 'var(--gutter-movil)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <button
        type="button"
        onClick={() => navigate('/mis-reservas')}
        style={{
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--text-body)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--color-accent)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'none',
        }}
      >
        ← Volver
      </button>

      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: 'var(--border-hairline)',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-surface)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Header con título y estado */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-h2)',
              fontWeight: 'var(--weight-bold)',
              margin: '0 0 var(--space-1) 0',
              color: 'var(--color-text)',
            }}>
              Reserva {r.folio}
            </h1>
            <p style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              margin: 0,
            }}>
              Código: {r.codigo_confirmacion}
            </p>
          </div>
          <EstadoBadge estado={r.estado} />
        </div>

        {/* Detalles principales en grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          {/* Servicio */}
          {r.servicio_nombre && (
            <div>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-1) 0',
              }}>
                Servicio
              </p>
              <p style={{
                fontSize: 'var(--text-title)',
                fontWeight: 'var(--weight-semibold)',
                margin: 0,
                color: 'var(--color-text)',
              }}>
                {r.servicio_nombre}
              </p>
            </div>
          )}

          {/* Fecha y hora */}
          <div>
            <p style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--track-eyebrow)',
              margin: '0 0 var(--space-1) 0',
            }}>
              Fecha y hora
            </p>
            <p style={{
              fontSize: 'var(--text-title)',
              fontWeight: 'var(--weight-semibold)',
              margin: 0,
              color: 'var(--color-text)',
            }}>
              {toLocalTime(r.fecha_hora_inicio, r.timezone)}
            </p>
          </div>

          {/* Modalidad */}
          {r.modalidad && (
            <div>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-1) 0',
              }}>
                Modalidad
              </p>
              <p style={{
                fontSize: 'var(--text-title)',
                fontWeight: 'var(--weight-semibold)',
                margin: 0,
                color: 'var(--color-text)',
              }}>
                {MODALIDAD_ICON[r.modalidad] ?? ''} {r.modalidad}
              </p>
            </div>
          )}

          {/* Asesor */}
          {r.asesor && (
            <div>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-1) 0',
              }}>
                Asesor
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                {r.asesor.avatar_url ? (
                  <img
                    src={r.asesor.avatar_url}
                    alt={r.asesor.nombre}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-full)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--color-accent)',
                  }}>
                    {r.asesor.nombre.charAt(0)}
                  </div>
                )}
                <span style={{
                  fontSize: 'var(--text-title)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--color-text)',
                }}>
                  {r.asesor.nombre}
                </span>
              </div>
            </div>
          )}

          {/* Sede */}
          {r.sede && (
            <div>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-1) 0',
              }}>
                Sede
              </p>
              <p style={{
                fontSize: 'var(--text-title)',
                fontWeight: 'var(--weight-semibold)',
                margin: 0,
                color: 'var(--color-text)',
              }}>
                {r.sede.nombre}
              </p>
              {r.sede.direccion && (
                <p style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-muted)',
                  margin: 'var(--space-1) 0 0 0',
                }}>
                  {r.sede.direccion}
                </p>
              )}
            </div>
          )}

          {/* Precio */}
          {r.precio_final && (
            <div>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-1) 0',
              }}>
                Precio
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-2)',
              }}>
                <p style={{
                  fontSize: 'var(--text-title)',
                  fontWeight: 'var(--weight-semibold)',
                  margin: 0,
                  color: 'var(--color-text)',
                }}>
                  {r.moneda === 'MXN' ? '$' : ''}
                  {new Intl.NumberFormat('es-MX').format(r.precio_final)} {r.moneda}
                </p>
                <span style={{
                  fontSize: 'var(--text-caption)',
                  color: r.estado_pago === 'completado'
                    ? 'var(--color-success)'
                    : r.estado_pago === 'pendiente'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-muted)',
                }}>
                  ({r.estado_pago === 'completado' ? 'Pagado' : r.estado_pago === 'pendiente' ? 'Pendiente' : 'Sin cobrar'})
                </span>
              </div>
            </div>
          )}

          {/* Notas */}
          {r.notas_cliente && (
            <div style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-lg)',
              border: 'var(--border-hairline)',
            }}>
              <p style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
                margin: '0 0 var(--space-2) 0',
              }}>
                Notas
              </p>
              <p style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text)',
                fontStyle: 'italic',
                margin: 0,
              }}>
                {r.notas_cliente}
              </p>
            </div>
          )}
        </div>

        {/* Timer si está en espera */}
        {r.estado === 'en_espera' && r.hold_expira_en && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <CountdownTimer expiraEn={r.hold_expira_en} />
          </div>
        )}

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          {/* Botón de pago */}
          {(r.estado === 'confirmada' || r.estado === 'en_espera') && r.estado_pago === 'pendiente' && !r.inscripcion_id && (
            <Button
              onClick={pagar}
              loading={pagarLoading}
              block
            >
              Pagar ahora
            </Button>
          )}

          {pagarError && (
            <p style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-error)',
              margin: 0,
            }}>
              {pagarError}
            </p>
          )}

          {/* Botón de unirse a sesión */}
          {puedeVerMeet && (
            <a
              href={r.meet_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-success)',
                color: 'white',
                textAlign: 'center',
                fontSize: 'var(--text-body)',
                fontWeight: 'var(--weight-semibold)',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'background-color var(--dur-interact) var(--ease-out)',
                border: 'none',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-success-dark)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-success)'}
            >
              Unirse a la sesión
            </a>
          )}

          {/* Botón de cancelar */}
          {esCancelable && (
            <Button
              variant="ghost"
              onClick={() => setShowCancelModal(true)}
              block
            >
              Cancelar reserva
            </Button>
          )}
        </div>
      </div>

      {/* Modal de confirmación de cancelación */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--gutter-movil)',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            maxWidth: 400,
            width: '100%',
            animation: 'riseIn var(--dur-enter) var(--ease-out)',
          }}>
            <h2 style={{
              fontSize: 'var(--text-h3)',
              fontWeight: 'var(--weight-bold)',
              margin: '0 0 var(--space-4) 0',
              color: 'var(--color-text)',
            }}>
              Cancelar reserva
            </h2>

            <p style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              margin: '0 0 var(--space-4) 0',
            }}>
              ¿Estás seguro de cancelar la reserva <strong>{r.folio}</strong>?
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-caption)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text)',
                marginBottom: 'var(--space-2)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--track-eyebrow)',
              }}>
                Motivo <span style={{ color: 'var(--color-text-muted)' }}>(opcional)</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: 'var(--border-hairline)',
                  fontSize: 'var(--text-body)',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
                placeholder="Ej: No podré asistir..."
              />
            </div>

            {cancelError && (
              <p style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-error)',
                marginBottom: 'var(--space-4)',
              }}>
                {cancelError.mensaje || 'Error al cancelar'}
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
            }}>
              <Button
                variant="ghost"
                onClick={() => setShowCancelModal(false)}
                block
              >
                Volver
              </Button>
              <Button
                variant="danger"
                onClick={handleCancelar}
                loading={cancelando}
                block
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
