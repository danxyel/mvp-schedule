import React, { useState } from 'react'
import { BookingFlow, ConfirmationScreen, MyReservations } from './index'

export function TestPage() {
  const [currentTest, setCurrentTest] = useState('booking')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar de navegación */}
      <div
        style={{
          width: 200,
          backgroundColor: '#1a1a1a',
          color: 'white',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Test Vértice</h2>
        <button
          onClick={() => setCurrentTest('booking')}
          style={{
            padding: '10px',
            backgroundColor: currentTest === 'booking' ? '#4f46e5' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          BookingFlow
        </button>
        <button
          onClick={() => setCurrentTest('confirmation')}
          style={{
            padding: '10px',
            backgroundColor: currentTest === 'confirmation' ? '#4f46e5' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          ConfirmationScreen
        </button>
        <button
          onClick={() => setCurrentTest('reservations')}
          style={{
            padding: '10px',
            backgroundColor: currentTest === 'reservations' ? '#4f46e5' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          MyReservations
        </button>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1 }}>
        {currentTest === 'booking' && <BookingFlow />}
        {currentTest === 'confirmation' && <ConfirmationScreen />}
        {currentTest === 'reservations' && <MyReservations />}
      </div>
    </div>
  )
}
