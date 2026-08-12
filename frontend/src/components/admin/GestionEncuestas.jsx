import { useState, useEffect, useCallback, Fragment } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import { errorMensaje } from '../../utils/errores'

const TIPOS_PREGUNTA = [
  { value: 'radio', label: 'Opción múltiple' },
  { value: 'escala', label: 'Escala lineal (1-5)' },
  { value: 'estrellas', label: 'Estrellas (1-5)' },
  { value: 'matriz', label: 'Matriz de calificación' },
  { value: 'textarea', label: 'Texto largo' },
]

const PREGUNTA_VACIA = {
  tipo: 'radio',
  label: '',
  requerido: false,
  opciones: ['Sí', 'No'],
  escalaEtiquetaMin: '',
  escalaEtiquetaMax: '',
  matrizFilas: [],
}

function generarId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function generarGrupoMatriz() {
  return `matriz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizarOpciones(opciones) {
  if (!opciones) return null
  if (Array.isArray(opciones)) return opciones.length > 0 ? opciones : null
  if (typeof opciones === 'object') return opciones
  return null
}

function camposAPreguntas(campos) {
  if (!campos?.length) return []

  const ordenados = [...campos].sort((a, b) => a.orden - b.orden)
  const porGrupo = new Map()
  const individuales = []

  for (const c of ordenados) {
    if (c.grupo_matriz) {
      if (!porGrupo.has(c.grupo_matriz)) porGrupo.set(c.grupo_matriz, [])
      porGrupo.get(c.grupo_matriz).push(c)
    } else {
      individuales.push(c)
    }
  }

  const preguntas = []

  for (const c of individuales) {
    const opciones = normalizarOpciones(c.opciones)
    if (c.tipo === 'radio') {
      preguntas.push({
        id: generarId(),
        tipo: 'radio',
        label: c.label,
        requerido: c.requerido,
        opciones: Array.isArray(opciones?.opciones) ? opciones.opciones : [],
        orden: c.orden,
        idsExistentes: [c.id],
      })
    } else if (c.tipo === 'numero' && opciones?.estilo === 'escala_lineal') {
      preguntas.push({
        id: generarId(),
        tipo: 'escala',
        label: c.label,
        requerido: c.requerido,
        escalaEtiquetaMin: opciones.etiqueta_min ?? '',
        escalaEtiquetaMax: opciones.etiqueta_max ?? '',
        orden: c.orden,
        idsExistentes: [c.id],
      })
    } else if (c.tipo === 'numero' && opciones?.estilo === 'estrellas') {
      preguntas.push({
        id: generarId(),
        tipo: 'estrellas',
        label: c.label,
        requerido: c.requerido,
        orden: c.orden,
        idsExistentes: [c.id],
      })
    } else if (c.tipo === 'textarea') {
      preguntas.push({
        id: generarId(),
        tipo: 'textarea',
        label: c.label,
        requerido: c.requerido,
        orden: c.orden,
        idsExistentes: [c.id],
      })
    } else if (c.tipo === 'numero') {
      // Fallback por si no trae estilo: lo mostramos como escala lineal
      preguntas.push({
        id: generarId(),
        tipo: 'escala',
        label: c.label,
        requerido: c.requerido,
        escalaEtiquetaMin: opciones?.etiqueta_min ?? '',
        escalaEtiquetaMax: opciones?.etiqueta_max ?? '',
        orden: c.orden,
        idsExistentes: [c.id],
      })
    }
  }

  for (const [, grupo] of porGrupo) {
    const primero = grupo[0]
    const opciones = normalizarOpciones(primero.opciones)
    preguntas.push({
      id: generarId(),
      tipo: 'matriz',
      label: '',
      requerido: primero.requerido,
      escalaEtiquetaMin: opciones?.etiqueta_min ?? '',
      escalaEtiquetaMax: opciones?.etiqueta_max ?? '',
      matrizFilas: grupo.map((c) => ({ id: generarId(), label: c.label, campoId: c.id })),
      orden: primero.orden,
      idsExistentes: grupo.map((c) => c.id),
    })
  }

  return preguntas.sort((a, b) => a.orden - b.orden)
}

function preguntasACampos(preguntas) {
  const campos = []
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i]
    const base = { label: p.label, requerido: p.requerido, orden: i }
    if (p.tipo === 'radio') {
      campos.push({
        ...base,
        tipo: 'radio',
        opciones: { opciones: p.opciones?.length ? p.opciones : ['Sí', 'No'] },
      })
    } else if (p.tipo === 'escala') {
      campos.push({
        ...base,
        tipo: 'numero',
        opciones: {
          estilo: 'escala_lineal',
          min: 1,
          max: 5,
          etiqueta_min: p.escalaEtiquetaMin || null,
          etiqueta_max: p.escalaEtiquetaMax || null,
        },
      })
    } else if (p.tipo === 'estrellas') {
      campos.push({
        ...base,
        tipo: 'numero',
        opciones: { estilo: 'estrellas', min: 1, max: 5 },
      })
    } else if (p.tipo === 'textarea') {
      campos.push({ ...base, tipo: 'textarea', opciones: null })
    } else if (p.tipo === 'matriz') {
      const grupo = generarGrupoMatriz()
      const filas = p.matrizFilas?.length ? p.matrizFilas : [{ id: generarId(), label: 'Pregunta' }]
      filas.forEach((fila, idx) => {
        campos.push({
          tipo: 'numero',
          label: fila.label,
          requerido: p.requerido,
          orden: i + idx,
          opciones: {
            estilo: 'escala_lineal',
            min: 1,
            max: 5,
            etiqueta_min: p.escalaEtiquetaMin || null,
            etiqueta_max: p.escalaEtiquetaMax || null,
          },
          grupo_matriz: grupo,
        })
      })
    }
  }
  return campos
}

export default function GestionEncuestas({ tenantSlug, token }) {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  const [editando, setEditando] = useState(null)
  const [plantilla, setPlantilla] = useState(null)
  const [camposOriginales, setCamposOriginales] = useState([])
  const [preguntas, setPreguntas] = useState([])
  const [cargandoEditor, setCargandoEditor] = useState(false)
  const [errorEditor, setErrorEditor] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [modalCrear, setModalCrear] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState(null)

  const [verRespuestas, setVerRespuestas] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [cargandoRespuestas, setCargandoRespuestas] = useState(false)
  const [errorRespuestas, setErrorRespuestas] = useState(null)
  const [filaExpandida, setFilaExpandida] = useState(null)

  const fetchPlantillas = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/formularios',
      {
        params: { path: { tenant_slug: tenantSlug }, query: { tipo: 'satisfaccion' } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setPlantillas(data ?? [])
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchPlantillas()
  }, [fetchPlantillas])

  const mostrarExito = (mensaje) => {
    setExito(mensaje)
    window.setTimeout(() => setExito(null), 4000)
  }

  const abrirEditor = async (p) => {
    setEditando(p)
    setCargandoEditor(true)
    setErrorEditor(null)
    setPlantilla(null)
    setCamposOriginales([])
    setPreguntas([])

    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/formularios/{formulario_id}',
      {
        params: { path: { tenant_slug: tenantSlug, formulario_id: p.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (fetchErr) {
      setErrorEditor(errorMensaje(fetchErr))
      setCargandoEditor(false)
      return
    }

    const campos = data.campos?.filter((c) => c.activo) ?? []
    setPlantilla(data)
    setCamposOriginales(campos)
    setPreguntas(camposAPreguntas(campos))
    setCargandoEditor(false)
  }

  const cerrarEditor = () => {
    setEditando(null)
    setPlantilla(null)
    setCamposOriginales([])
    setPreguntas([])
    setErrorEditor(null)
  }

  const abrirRespuestas = async (p) => {
    setVerRespuestas(p)
    setCargandoRespuestas(true)
    setErrorRespuestas(null)
    setRespuestas([])
    setFilaExpandida(null)

    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/formularios/{formulario_id}/respuestas',
      {
        params: { path: { tenant_slug: tenantSlug, formulario_id: p.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (fetchErr) {
      setErrorRespuestas(errorMensaje(fetchErr))
      setCargandoRespuestas(false)
      return
    }
    setRespuestas(data ?? [])
    setCargandoRespuestas(false)
  }

  const cerrarRespuestas = () => {
    setVerRespuestas(null)
    setRespuestas([])
    setErrorRespuestas(null)
    setFilaExpandida(null)
  }

  const crearPlantilla = async (e) => {
    e.preventDefault()
    if (creando) return
    const nombre = nuevoNombre.trim()
    if (!nombre) {
      setErrorCrear('Ingresa un nombre para la plantilla.')
      return
    }
    setCreando(true)
    setErrorCrear(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/formularios',
      {
        params: { path: { tenant_slug: tenantSlug } },
        body: { nombre, tipo: 'satisfaccion' },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCreando(false)
    if (fetchErr) {
      setErrorCrear(errorMensaje(fetchErr))
      return
    }
    setPlantillas((prev) => [data, ...prev])
    setModalCrear(false)
    setNuevoNombre('')
    mostrarExito('Plantilla creada.')
    abrirEditor(data)
  }

  const actualizarPlantilla = async (nombre, activo) => {
    const body = {}
    if (nombre !== undefined && nombre !== plantilla.nombre) body.nombre = nombre
    if (activo !== undefined && activo !== plantilla.activo) body.activo = activo
    if (Object.keys(body).length === 0) return null

    const { data, error: fetchErr } = await client.PATCH(
      '/api/v2/{tenant_slug}/admin/formularios/{formulario_id}',
      {
        params: { path: { tenant_slug: tenantSlug, formulario_id: plantilla.id } },
        body,
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) return fetchErr
    setPlantilla(data)
    setPlantillas((prev) => prev.map((p) => (p.id === data.id ? { ...p, nombre: data.nombre, activo: data.activo } : p)))
    return null
  }

  const guardar = async () => {
    if (guardando) return

    const errores = []
    for (const p of preguntas) {
      if (!p.label.trim() && p.tipo !== 'matriz') errores.push('Todas las preguntas deben tener un texto.')
      if (p.tipo === 'radio' && (!p.opciones || p.opciones.length === 0)) {
        errores.push('Las preguntas de opción múltiple necesitan al menos una opción.')
      }
      if (p.tipo === 'matriz' && (!p.matrizFilas || p.matrizFilas.length === 0)) {
        errores.push('Las matrices de calificación necesitan al menos una fila.')
      }
      if (p.tipo === 'matriz') {
        for (const f of p.matrizFilas) {
          if (!f.label.trim()) errores.push('Todas las filas de una matriz deben tener texto.')
        }
      }
    }
    if (errores.length > 0) {
      setErrorEditor(errores[0])
      return
    }

    setGuardando(true)
    setErrorEditor(null)

    const errActualizar = await actualizarPlantilla(plantilla.nombre, undefined)
    if (errActualizar) {
      setErrorEditor(errorMensaje(errActualizar))
      setGuardando(false)
      return
    }

    const idsDesactivar = camposOriginales.map((c) => c.id)
    for (const campoId of idsDesactivar) {
      await client.PATCH(
        '/api/v2/{tenant_slug}/admin/formularios/{formulario_id}/campos/{campo_id}/desactivar',
        {
          params: { path: { tenant_slug: tenantSlug, formulario_id: plantilla.id, campo_id: campoId } },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
    }

    const campos = preguntasACampos(preguntas)
    if (campos.length > 0) {
      const { error: bulkErr } = await client.POST(
        '/api/v2/{tenant_slug}/admin/formularios/{formulario_id}/campos',
        {
          params: { path: { tenant_slug: tenantSlug, formulario_id: plantilla.id } },
          body: { items: campos },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (bulkErr) {
        setErrorEditor(errorMensaje(bulkErr))
        setGuardando(false)
        return
      }
    }

    await abrirEditor(plantilla)
    setGuardando(false)
    mostrarExito('Plantilla guardada.')
  }

  const agregarPregunta = () => {
    const base = { ...PREGUNTA_VACIA, id: generarId(), orden: preguntas.length }
    if (base.tipo === 'matriz') base.matrizFilas = [{ id: generarId(), label: '' }]
    setPreguntas((prev) => [...prev, base])
  }

  const cambiarTipoPregunta = (id, nuevoTipo) => {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const actualizada = { ...p, tipo: nuevoTipo }
        if (nuevoTipo === 'radio' && !Array.isArray(actualizada.opciones)) {
          actualizada.opciones = ['Sí', 'No']
        }
        if (nuevoTipo === 'matriz' && (!actualizada.matrizFilas || actualizada.matrizFilas.length === 0)) {
          actualizada.matrizFilas = [{ id: generarId(), label: '' }]
        }
        return actualizada
      }),
    )
  }

  const actualizarPregunta = (id, cambios) => {
    setPreguntas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  const moverPregunta = (id, direccion) => {
    setPreguntas((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx < 0) return prev
      const nuevoIdx = idx + direccion
      if (nuevoIdx < 0 || nuevoIdx >= prev.length) return prev
      const nueva = [...prev]
      const temp = nueva[idx]
      nueva[idx] = nueva[nuevoIdx]
      nueva[nuevoIdx] = temp
      return nueva.map((p, i) => ({ ...p, orden: i }))
    })
  }

  const eliminarPregunta = (id) => {
    setPreguntas((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, orden: i })))
  }

  const agregarOpcion = (preguntaId) => {
    setPreguntas((prev) =>
      prev.map((p) => (p.id === preguntaId ? { ...p, opciones: [...(p.opciones || []), ''] } : p)),
    )
  }

  const cambiarOpcion = (preguntaId, idx, valor) => {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== preguntaId) return p
        const opciones = [...(p.opciones || [])]
        opciones[idx] = valor
        return { ...p, opciones }
      }),
    )
  }

  const quitarOpcion = (preguntaId, idx) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? { ...p, opciones: (p.opciones || []).filter((_, i) => i !== idx) }
          : p,
      ),
    )
  }

  const agregarFilaMatriz = (preguntaId) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? { ...p, matrizFilas: [...(p.matrizFilas || []), { id: generarId(), label: '' }] }
          : p,
      ),
    )
  }

  const cambiarFilaMatriz = (preguntaId, filaId, valor) => {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== preguntaId) return p
        return {
          ...p,
          matrizFilas: p.matrizFilas.map((f) => (f.id === filaId ? { ...f, label: valor } : f)),
        }
      }),
    )
  }

  const quitarFilaMatriz = (preguntaId, filaId) => {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId
          ? { ...p, matrizFilas: p.matrizFilas.filter((f) => f.id !== filaId) }
          : p,
      ),
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-full max-w-xs rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar plantillas</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchPlantillas}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (editando) {
    return (
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={cerrarEditor}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Volver a plantillas
          </button>
          {plantilla && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Activa</span>
              <button
                type="button"
                role="switch"
                aria-checked={plantilla.activo}
                disabled={guardando}
                onClick={() => actualizarPlantilla(undefined, !plantilla.activo)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  plantilla.activo ? 'bg-green-500' : 'bg-gray-300'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    plantilla.activo ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {exito && (
          <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {exito}
          </p>
        )}
        {errorEditor && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorEditor}
          </p>
        )}

        {cargandoEditor ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="plantilla-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre de la plantilla
              </label>
              <input
                id="plantilla-nombre"
                type="text"
                value={plantilla?.nombre ?? ''}
                onChange={(e) => setPlantilla((p) => ({ ...p, nombre: e.target.value }))}
                disabled={guardando}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Preguntas</h3>
              <button
                type="button"
                onClick={agregarPregunta}
                disabled={guardando}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                + Agregar pregunta
              </button>
            </div>

            {preguntas.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                Esta plantilla no tiene preguntas. Agrega la primera para que la encuesta se pueda enviar.
              </p>
            ) : (
              <div className="space-y-3">
                {preguntas.map((p, idx) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-start gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Tipo de pregunta
                        </label>
                        <select
                          value={p.tipo}
                          onChange={(e) => cambiarTipoPregunta(p.id, e.target.value)}
                          disabled={guardando}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          {TIPOS_PREGUNTA.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Subir"
                          disabled={idx === 0 || guardando}
                          onClick={() => moverPregunta(p.id, -1)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="Bajar"
                          disabled={idx === preguntas.length - 1 || guardando}
                          onClick={() => moverPregunta(p.id, 1)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => eliminarPregunta(p.id)}
                          disabled={guardando}
                          className="rounded-lg border border-red-200 px-2 py-1 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {p.tipo !== 'matriz' && (
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Texto de la pregunta
                        </label>
                        <input
                          type="text"
                          value={p.label}
                          onChange={(e) => actualizarPregunta(p.id, { label: e.target.value })}
                          disabled={guardando}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                    )}

                    {p.tipo === 'radio' && (
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Opciones</label>
                        <div className="space-y-2">
                          {p.opciones?.map((op, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={op}
                                onChange={(e) => cambiarOpcion(p.id, i, e.target.value)}
                                disabled={guardando}
                                placeholder={`Opción ${i + 1}`}
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                              />
                              <button
                                type="button"
                                onClick={() => quitarOpcion(p.id, i)}
                                disabled={guardando}
                                className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => agregarOpcion(p.id)}
                          disabled={guardando}
                          className="mt-2 text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          + Agregar opción
                        </button>
                      </div>
                    )}

                    {(p.tipo === 'escala' || p.tipo === 'matriz') && (
                      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Etiqueta mínima (1)
                          </label>
                          <input
                            type="text"
                            value={p.escalaEtiquetaMin}
                            onChange={(e) => actualizarPregunta(p.id, { escalaEtiquetaMin: e.target.value })}
                            disabled={guardando}
                            placeholder="Ej. Muy insatisfecho"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Etiqueta máxima (5)
                          </label>
                          <input
                            type="text"
                            value={p.escalaEtiquetaMax}
                            onChange={(e) => actualizarPregunta(p.id, { escalaEtiquetaMax: e.target.value })}
                            disabled={guardando}
                            placeholder="Ej. Muy satisfecho"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {p.tipo === 'matriz' && (
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Filas</label>
                        <div className="space-y-2">
                          {p.matrizFilas?.map((fila) => (
                            <div key={fila.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={fila.label}
                                onChange={(e) => cambiarFilaMatriz(p.id, fila.id, e.target.value)}
                                disabled={guardando}
                                placeholder="Texto de la fila"
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                              />
                              <button
                                type="button"
                                onClick={() => quitarFilaMatriz(p.id, fila.id)}
                                disabled={guardando}
                                className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => agregarFilaMatriz(p.id)}
                          disabled={guardando}
                          className="mt-2 text-sm font-medium text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          + Agregar fila
                        </button>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={p.requerido}
                        onChange={(e) => actualizarPregunta(p.id, { requerido: e.target.checked })}
                        disabled={guardando}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      Obligatoria
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarEditor}
                disabled={guardando}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar plantilla'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (verRespuestas) {
    return (
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={cerrarRespuestas}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Volver a plantillas
          </button>
          <p className="text-sm font-medium text-gray-900">{verRespuestas.nombre}</p>
        </div>

        {errorRespuestas && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorRespuestas}
          </p>
        )}

        {cargandoRespuestas ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Respondió</th>
                  <th className="px-4 py-3 text-right font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {respuestas.map((r) => (
                  <Fragment key={r.reserva_id}>
                    <tr className="transition hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                      <td className="px-4 py-3 text-gray-700">{r.cliente_email || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(r.respondido_en).toLocaleString('es-MX')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setFilaExpandida((prev) => (prev === r.reserva_id ? null : r.reserva_id))
                          }
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          {filaExpandida === r.reserva_id ? 'Ocultar' : 'Ver respuestas'}
                        </button>
                      </td>
                    </tr>
                    {filaExpandida === r.reserva_id && (
                      <tr>
                        <td colSpan={4} className="bg-gray-50 px-4 py-4">
                          <dl className="space-y-3">
                            {r.respuestas.map((resp) => (
                              <div key={resp.campo_id}>
                                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                  {resp.label}
                                  {resp.grupo_matriz ? ` (${resp.grupo_matriz})` : ''}
                                </dt>
                                <dd className="text-sm text-gray-900">{resp.valor || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {respuestas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      Nadie ha respondido esta encuesta todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{plantillas.length}</span> plantillas
        </p>
        <button
          type="button"
          onClick={() => setModalCrear(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Nueva plantilla
        </button>
      </div>

      {exito && (
        <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {exito}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Preguntas</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plantillas.map((p) => (
              <tr key={p.id} className="transition hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      p.activo
                        ? 'border-green-200 bg-green-100 text-green-700'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{p.num_campos}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => abrirRespuestas(p)}
                    className="mr-2 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Ver respuestas
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirEditor(p)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {plantillas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  No hay plantillas de encuestas. Crea la primera.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalCrear && (
        <Modal title="Nueva plantilla de encuesta" onClose={() => setModalCrear(false)} maxWidth="max-w-sm">
          <form onSubmit={crearPlantilla} className="space-y-4" noValidate>
            <div>
              <label htmlFor="nueva-plantilla-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                id="nueva-plantilla-nombre"
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                disabled={creando}
                placeholder="Ej. Encuesta post-sesión"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            {errorCrear && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorCrear}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalCrear(false)}
                disabled={creando}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creando}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
