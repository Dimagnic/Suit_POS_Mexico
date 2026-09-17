'use client'

import { useState } from 'react'
import { markRoomAvailable, getRooms } from './hotel-actions'
import RoomClient from './room-client'

type Room = { id: string; name: string; status: string }
type RoomType = { id: string; name: string; price: number }

export default function HotelClient({
  rooms,
  roomTypes,
  organizationId,
  branchId,
  giroId,
  giroSlug,
  giroNombre,
  giroIcono,
  cashierId,
}: {
  rooms: Room[]
  roomTypes: RoomType[]
  organizationId: string
  branchId: string
  giroId: string
  giroSlug: string
  giroNombre: string
  giroIcono: string | null
  cashierId: string
}) {
  const [roomList, setRoomList] = useState<Room[]>(rooms)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const refreshRooms = async () => {
    const updated = await getRooms(organizationId, giroId)
    setRoomList(updated as Room[])
  }

  const handleBack = async () => {
    await refreshRooms()
    setSelectedRoom(null)
  }

  const handleMarkAvailable = async (roomId: string) => {
    await markRoomAvailable(roomId)
    await refreshRooms()
  }

  if (selectedRoom) {
    return (
      <RoomClient
        room={selectedRoom}
        roomTypes={roomTypes}
        organizationId={organizationId}
        branchId={branchId}
        giroId={giroId}
        giroSlug={giroSlug}
        cashierId={cashierId}
        onBack={handleBack}
      />
    )
  }

  const statusLabel: Record<string, string> = {
    available: 'Disponible',
    occupied: 'Ocupada',
    cleaning: 'Limpieza',
  }
  const statusColor: Record<string, string> = {
    available: 'var(--text-muted)',
    occupied: 'var(--accent)',
    cleaning: 'var(--danger)',
  }

  return (
    <main style={{ padding: 'var(--space-3)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.25rem' }}>{giroIcono} {giroNombre} — Habitaciones</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        {roomList.map((r) => {
          const occupied = r.status === 'occupied'
          const cleaning = r.status === 'cleaning'
          return (
            <div
              key={r.id}
              style={{
                background: occupied ? 'var(--surface-2)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${statusColor[r.status]}`,
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-2)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🛏️</div>
              <strong>{r.name}</strong>
              <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8rem', color: statusColor[r.status] }}>
                {statusLabel[r.status]}
              </p>

              {cleaning ? (
                <button
                  onClick={() => handleMarkAvailable(r.id)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Marcar disponible
                </button>
              ) : (
                <button
                  onClick={() => setSelectedRoom(r)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  {occupied ? 'Ver reservación' : 'Reservar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}