import React from 'react'

export default function GuiaColoresEstados() {
  const tonos = [
    {
      name: 'Accent (Indigo)',
      tone: 'accent',
      desc: 'Interacción, disponibilidad y llamadas a la acción. Usado para elementos interactivos y capacidad disponible.',
      color: '#4f46e5',
      colors: [
        { name: '100', hex: '#e0e7ff', border: '#c7d2fe' },
        { name: '600', hex: '#4f46e5' },
        { name: '800', hex: '#3730a3' }
      ]
    },
    {
      name: 'Positive (Teal)',
      tone: 'positive',
      desc: 'Confirmación y éxito. Indica que una acción se completó correctamente o un estado positivo.',
      color: '#0d9488',
      colors: [
        { name: '100', hex: '#ccfbf1', border: '#99f6e4' },
        { name: '600', hex: '#0d9488' },
        { name: '800', hex: '#0d7377' }
      ]
    },
    {
      name: 'Warn (Amber)',
      tone: 'warn',
      desc: 'Atención y estado pendiente. Indica que se requiere una acción del usuario o hay algo en espera.',
      color: '#d97706',
      colors: [
        { name: '100', hex: '#fef3c7', border: '#fde68a' },
        { name: '600', hex: '#d97706' },
        { name: '800', hex: '#b45309' }
      ]
    },
    {
      name: 'Idle (Slate)',
      tone: 'idle',
      desc: 'Neutro e inactivo. Estados completados, cancelados o que no requieren acción inmediata del usuario.',
      color: '#64748b',
      colors: [
        { name: '100', hex: '#e2e8f0', border: '#cbd5e1' },
        { name: '600', hex: '#64748b' },
        { name: '800', hex: '#475569' }
      ]
    }
  ]

  const estados = [
    {
      title: 'Confirmada',
      tone: 'positive',
      label: 'TONE: positive',
      badge: 'confirmada',
      meta: 'Reserva confirmada y lista. El usuario ya está inscrito y debe asistir a la sesión.'
    },
    {
      title: 'En Espera de Pago',
      tone: 'warn',
      label: 'TONE: warn',
      badge: 'en_espera',
      meta: 'Reserva propuesta que requiere confirmación de pago. El usuario debe completar la acción de pago.'
    },
    {
      title: 'Procesando',
      tone: 'idle',
      label: 'TONE: idle',
      badge: 'pendiente',
      meta: 'Reserva en proceso. Será confirmada por el administrador. No requiere acción del usuario.'
    },
    {
      title: 'Completada',
      tone: 'idle',
      label: 'TONE: idle',
      badge: 'completada',
      meta: 'Sesión finalizada exitosamente. El usuario ya asistió y se completó la actividad.'
    },
    {
      title: 'Cancelada',
      tone: 'idle',
      label: 'TONE: idle',
      badge: 'cancelada',
      meta: 'Reserva cancelada. El usuario no asistirá. No requiere acción adicional.'
    },
    {
      title: 'No Asistió',
      tone: 'idle',
      label: 'TONE: idle',
      badge: 'no_show',
      meta: 'Usuario no asistió a la sesión confirmada. Se registra la inasistencia en el sistema.'
    }
  ]

  const badgeClasses = {
    positive: 'bg-teal-100 text-teal-800 border-teal-300',
    warn: 'bg-amber-100 text-amber-700 border-amber-300',
    idle: 'bg-slate-100 text-slate-600 border-slate-300',
    accent: 'bg-indigo-100 text-indigo-700 border-indigo-300'
  }

  const toneIndicatorColors = {
    positive: '#0d9488',
    warn: '#d97706',
    idle: '#64748b',
    accent: '#4f46e5'
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🎨 Sistema de Color de Estados
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Vértice Design System — MVP Schedule
        </p>
      </div>

      {/* Tonos del Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {tonos.map((tono) => (
          <div
            key={tono.tone}
            className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              style={{ backgroundColor: tono.color }}
              className="h-32 flex items-center justify-center text-white font-semibold text-sm"
            >
              {tono.name.split(' ')[0]}
            </div>
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {tono.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {tono.desc}
              </p>
              <div className="flex gap-2">
                {tono.colors.map((color) => (
                  <div key={color.name} className="flex flex-col gap-1 flex-1">
                    <div
                      style={{
                        backgroundColor: color.hex,
                        borderColor: color.border || 'transparent',
                        borderWidth: '1px'
                      }}
                      className="w-full h-10 rounded"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {color.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estados de Reserva */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 mb-12 shadow-sm">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Estados de Reserva
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">
          Mapeo de estados de reserva a tonos del sistema Vértice. El sistema no define color de error; los estados inactivos usan tone <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">idle</code>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {estados.map((estado) => (
            <div
              key={estado.badge}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  style={{ backgroundColor: toneIndicatorColors[estado.tone] }}
                  className="w-4 h-4 rounded-full"
                />
                <span className="font-bold text-gray-900 dark:text-white">
                  {estado.title}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {estado.label}
              </div>
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-3 ${
                  badgeClasses[estado.tone]
                }`}
              >
                {estado.title.toLowerCase()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                {estado.meta}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Implementación */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Implementación en Frontend
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          Utiliza las funciones del módulo <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">frontend/src/utils/estado.js</code> para aplicar estilos consistentes:
        </p>

        <div className="bg-gray-100 dark:bg-gray-900 border-l-4 border-indigo-500 p-4 rounded text-sm text-gray-800 dark:text-gray-200 font-mono text-xs overflow-x-auto mb-6">
          <pre>{`// Importar funciones del módulo de estado
import { badgeClassForEstado } from '../utils/estado'

// Para un estado de reserva
<span className={badgeClassForEstado(r.estado)}>
  {ESTADO_LABEL[r.estado]}
</span>`}</pre>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-2">
            Principios de aplicación:
          </p>
          <ul className="text-sm text-indigo-800 dark:text-indigo-300 space-y-1 ml-4">
            <li>✓ Un solo color para cada trabajo semántico</li>
            <li>✓ Mantener consistencia visual en toda la app</li>
            <li>✓ No inventar nuevos colores fuera del sistema</li>
            <li>✓ Usar las constantes y funciones centralizadas</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
