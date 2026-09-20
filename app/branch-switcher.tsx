'use client'

import { useTransition } from 'react'
import { setActiveBranch } from './branches/actions'

export default function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: { id: string; name: string; is_main: boolean }[]
  activeBranchId: string | null
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(branchId: string) {
    startTransition(async () => {
      await setActiveBranch(branchId)
      window.location.reload()
    })
  }

  const activeName = branches.find((b) => b.id === activeBranchId)?.name

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {activeName && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Estás en: <strong style={{ color: 'var(--text)' }}>{activeName}</strong>
        </span>
      )}

      <select
        value={activeBranchId ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="mono"
        style={{
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '0.5rem 0.75rem',
          fontSize: '0.85rem',
        }}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}{b.is_main ? ' (Principal)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}