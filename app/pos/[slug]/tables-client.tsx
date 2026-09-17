'use client'

import { useState } from 'react'
import TableOrderClient from './table-order-client'
import { getTables } from './table-actions'

type Table = { id: string; name: string; status: string }
type Product = { id: string; name: string; price: number; category: string | null }

export default function TablesClient({
  tables,
  products,
  organizationId,
  branchId,
  giroId,
  waiterId,
}: {
  tables: Table[]
  products: Product[]
  organizationId: string
  branchId: string
  giroId: string
  waiterId: string
}) {
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  const refreshTables = async () => {
    const updated = await getTables(organizationId)
    setTableList(updated as Table[])
  }

  const handleBack = async () => {
    await refreshTables()
    setSelectedTable(null)
  }

  if (selectedTable) {
    return (
      <TableOrderClient
        table={selectedTable}
        products={products}
        organizationId={organizationId}
        branchId={branchId}
        giroId={giroId}
        waiterId={waiterId}
        onBack={handleBack}
      />
    )
  }

  return (
    <main style={{ padding: 'var(--space-3)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.25rem' }}>🍽️ Restaurante — Mesas</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        {tableList.map((t) => {
          const occupied = t.status === 'occupied'
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTable(t)}
              style={{
                background: occupied ? 'var(--surface-2)' : 'var(--surface)',
                border: occupied ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderLeft: occupied ? '3px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🍽️</div>
              <strong>{t.name}</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: occupied ? 'var(--accent)' : 'var(--text-muted)' }}>
                {occupied ? 'Ocupada' : 'Disponible'}
              </p>
            </button>
          )
        })}
      </div>
    </main>
  )
}