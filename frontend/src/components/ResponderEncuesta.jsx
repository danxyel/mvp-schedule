import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { Card, Button } from './ui'

const ESTADOS = {
  VALIDANDO: 'validando',
  VALIDO: 'valido',
  YA_RESPONDIDA: 'ya_respondida',
  EXPIRADA: 'expirada',
  NO_ENCONTRADA: 'no_encontrada',
  ERROR: 'error',
  ENVIANDO: 'enviando',
  EXITO: 'exito',
}

function errorMensajeLocal(err) {
  if (err?.detail && typeof err.detail === 'object') return err.detail.mensaje || err.detail.codigo
  if (err?.detail && typeof err.detail === 'string') return err.detail
  return err?.mensaje || err?.message || 'Ocurrió un error inesperado.'
}

function StarRating({ value, onChange, min = 1, max = 5 }) {
  const [hover, setHover] = useState(null)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className="text-2xl transition focus:outline-none"
          style={{ color: (hover || value) >= n ? '#f59e0b' : '#d1d5db' }}
          aria-label={`${n} estrellas`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function CampoInput({ campo, value, onChange, error }) {
  const tipo = campo.tipo
  const estilo = campo.opciones?.estilo

  if (tipo === 'radio' || tipo === 'select') {
    const opciones = Array.isArray(campo.opciones)
      ? campo.opciones
      : campo.opciones?.opciones || campo.opciones?.lista || []
    return (
      <div className="space-y-2">
        {opciones.map((op, idx) => {
          const valorOp = typeof op === 'string' ? op : op.valor || op.label || op
          const labelOp = typeof op === 'string' ? op : op.label || op.valor || op
          return (
            <label key={idx} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={`campo-${campo.id}`}
                value={valorOp}
                checked={String(value) === String(valorOp)}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              {labelOp}
            </label>
          )
        })}
      </div>
    )
  }

  if (tipo === 'numero' && estilo === 'estrellas') {
    return (
      <StarRating
        value={value ? Number(value) : 0}
        onChange={(n) => onChange(String(n))}
        min={campo.opciones?.min || 1}
        max={campo.opciones?.max || 5}
      />
    )
  }

  if (tipo === 'numero' && estilo === 'escala_lineal') {
    const min = campo.opciones?.min || 1
    const max = campo.opciones?.max || 5
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`h-10 w-10 rounded-lg border text-sm font-medium transition ${
                String(value) === String(n)
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{campo.opciones?.etiqueta_min || 'Muy malo'}</span>
          <span>{campo.opciones?.etiqueta_max || 'Muy bueno'}</span>
        </div>
      </div>
    )
  }

  if (tipo === 'textarea' || tipo === 'texto') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={campo.placeholder || ''}
        rows={tipo === 'textarea' ? 4 : 2}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
    )
  }

  // Fallback para cualquier otro tipo
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={campo.placeholder || ''}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500 ${
        error ? 'border-red-300' : 'border-gray-300'
      }`}
    />
  )
}

export default function ResponderEncuesta() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [estado, setEstado] = useState(ESTADOS.VALIDANDO)
  const [mensaje, setMensaje] = useState('')
  const [encuesta, setEncuesta] = useState(null)
  const [respuestas, setRespuestas] = useState({})
  const [errores, setErrores] = useState({})
  const [camposPorGrupo, setCamposPorGrupo] = useState([])

  useEffect(() => {
    if (!token) {
      setEstado(ESTADOS.NO_ENCONTRADA)
      setMensaje('El enlace no contiene un token válido.')
      return
    }

    let activo = true
    client.GET('/encuestas/validar', { params: { query: { token } } }).then(({ data, error: fetchErr }) => {
      if (!activo) return
      if (fetchErr) {
        const codigo = fetchErr?.detail?.codigo || fetchErr?.codigo
        if (codigo === 'encuesta_ya_respondida') {
          setEstado(ESTADOS.YA_RESPONDIDA)
        } else if (codigo === 'encuesta_expirada') {
          setEstado(ESTADOS.EXPIRADA)
        } else {
          setEstado(ESTADOS.NO_ENCONTRADA)
        }
        setMensaje(errorMensajeLocal(fetchErr))
        return
      }
      setEncuesta(data)

      // Agrupar campos: primero los que NO tienen grupo_matriz, luego matrices
      const individuales = data.campos.filter((c) => !c.grupo_matriz)
      const grupos = data.campos
        .filter((c) => c.grupo_matriz)
        .reduce((acc, c) => {
          if (!acc[c.grupo_matriz]) acc[c.grupo_matriz] = []
          acc[c.grupo_matriz].push(c)
          return acc
        }, {})
      setCamposPorGrupo([
        { tipo: 'individuales', campos: individuales },
        ...Object.entries(grupos).map(([grupo, campos]) => ({
          tipo: 'matriz',
          grupo,
          campos: campos.sort((a, b) => a.orden - b.orden),
        })),
      ])

      setEstado(ESTADOS.VALIDO)
    })

    return () => {
      activo = false
    }
  }, [token])

  const setRespuesta = (campoId, valor) => {
    setRespuestas((prev) => ({ ...prev, [campoId]: valor }))
    setErrores((prev) => {
      const next = { ...prev }
      delete next[campoId]
      return next
    })
  }

  const validar = () => {
    const nextErrores = {}
    encuesta.campos.forEach((campo) => {
      const v = respuestas[campo.id]
      if (campo.requerido && (v === undefined || v === null || String(v).trim() === '')) {
        nextErrores[campo.id] = 'Este campo es obligatorio'
      }
    })
    setErrores(nextErrores)
    return Object.keys(nextErrores).length === 0
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!validar()) return

    setEstado(ESTADOS.ENVIANDO)
    const { error: fetchErr } = await client.POST('/encuestas/responder', {
      body: { token, respuestas },
    })
    if (fetchErr) {
      setEstado(ESTADOS.ERROR)
      setMensaje(errorMensajeLocal(fetchErr))
      return
    }
    setEstado(ESTADOS.EXITO)
  }

  if (estado === ESTADOS.VALIDANDO) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <p className="text-gray-600">Cargando encuesta...</p>
        </Card>
      </div>
    )
  }

  if ([ESTADOS.NO_ENCONTRADA, ESTADOS.EXPIRADA, ESTADOS.YA_RESPONDIDA, ESTADOS.ERROR].includes(estado)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <h1 className="mb-2 text-lg font-semibold text-gray-900">
            {estado === ESTADOS.YA_RESPONDIDA
              ? 'Encuesta ya respondida'
              : estado === ESTADOS.EXPIRADA
              ? 'Enlace expirado'
              : 'No encontrada'}
          </h1>
          <p className="text-sm text-gray-600">{mensaje}</p>
        </Card>
      </div>
    )
  }

  if (estado === ESTADOS.EXITO) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <div className="mb-4 text-4xl">✓</div>
          <h1 className="mb-2 text-lg font-semibold text-gray-900">Gracias por tu respuesta</h1>
          <p className="text-sm text-gray-600">Tu opinión nos ayuda a mejorar.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 py-10">
      <Card className="w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{encuesta.formulario_nombre}</h1>
          <p className="text-sm text-gray-500">Responde con honestidad. Tus respuestas son anónimas.</p>
        </div>

        <form onSubmit={enviar} className="space-y-6">
          {camposPorGrupo.map((grupo, idx) =>
            grupo.tipo === 'matriz' ? (
              <div key={`matriz-${idx}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {grupo.grupo}
                </h2>
                <div className="space-y-4">
                  {grupo.campos.map((campo) => (
                    <div key={campo.id}>
                      <label className="mb-2 block text-sm font-medium text-gray-700">{campo.label}</label>
                      <CampoInput
                        campo={campo}
                        value={respuestas[campo.id]}
                        onChange={(v) => setRespuesta(campo.id, v)}
                        error={errores[campo.id]}
                      />
                      {errores[campo.id] && <p className="mt-1 text-sm text-red-600">{errores[campo.id]}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div key={`ind-${idx}`} className="space-y-4">
                {grupo.campos.map((campo) => (
                  <div key={campo.id}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {campo.label}
                      {campo.requerido && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    {campo.ayuda && <p className="mb-2 text-xs text-gray-500">{campo.ayuda}</p>}
                    <CampoInput
                      campo={campo}
                      value={respuestas[campo.id]}
                      onChange={(v) => setRespuesta(campo.id, v)}
                      error={errores[campo.id]}
                    />
                    {errores[campo.id] && <p className="mt-1 text-sm text-red-600">{errores[campo.id]}</p>}
                  </div>
                ))}
              </div>
            )
          )}

          <Button type="submit" loading={estado === ESTADOS.ENVIANDO}>
            Enviar respuestas
          </Button>
        </form>
      </Card>
    </div>
  )
}
