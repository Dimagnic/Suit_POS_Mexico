'use client'

import { useState } from 'react'

type ToolId = 'scan' | 'print' | 'drawer' | 'terminal' | 'scale'

const TOOLS: { id: ToolId; icon: string; label: string; info: string }[] = [
  {
    id: 'scan',
    icon: '🔎',
    label: 'Escáner',
    info: 'Ya funciona: cualquier lector de código de barras USB actúa como teclado. Enfoca el campo de escaneo y pasa el producto.',
  },
  {
    id: 'print',
    icon: '🖨️',
    label: 'Imprimir',
    info: 'Imprime el ticket en cualquier impresora conectada a tu computadora (normal o térmica).',
  },
  {
    id: 'drawer',
    icon: '💰',
    label: 'Cajón',
    info: 'El cajón de dinero casi siempre se abre a través de la impresora térmica (no se conecta solo). Se activará al integrar una impresora térmica compatible con comandos ESC/POS.',
  },
  {
    id: 'terminal',
    icon: '💳',
    label: 'Terminal',
    info: 'El cobro con tarjeta requiere una terminal física y su SDK correspondiente (por ejemplo Stripe Terminal). Pendiente de integrar cuando el negocio tenga la terminal.',
  },
  {
    id: 'scale',
    icon: '⚖️',
    label: 'Báscula',
    info: 'Las básculas electrónicas se conectan por USB/serial y requieren programarse según la marca del equipo (vía WebSerial). Pendiente hasta definir el modelo que usará el negocio.',
  },
]

export default function PosToolsBar({
  onScan,
  scanNotApplicableHint,
  onPrint,
  printEnabled,
  printDisabledHint,
}: {
  onScan?: () => void
  scanNotApplicableHint?: string
  onPrint: () => void
  printEnabled: boolean
  printDisabledHint: string
}) {
  const [active, setActive] = useState<ToolId | null>(null)

  function handleClick(id: ToolId) {
    if (id === 'scan' && onScan) {
      onScan()
      setActive('scan')
      return
    }
    if (id === 'print' && printEnabled) {
      onPrint()
      return
    }
    setActive(active === id ? null : id)
  }

  function infoFor(id: ToolId) {
    if (id === 'scan' && !onScan) return scanNotApplicableHint ?? 'No aplica en este giro.'
    if (id === 'print' && !printEnabled) return printDisabledHint
    return TOOLS.find((t) => t.id === id)?.info ?? ''
  }

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {TOOLS.map((tool) => {
          const dimmed = tool.id === 'print' && !printEnabled
          return (
            <button
              key={tool.id}
              title={tool.label}
              onClick={() => handleClick(tool.id)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                fontSize: '1.1rem',
                background: active === tool.id ? 'var(--surface)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                cursor: 'pointer',
                opacity: dimmed ? 0.5 : 1,
              }}
            >
              {tool.icon}
            </button>
          )
        })}
      </div>

      {active && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: '0.6rem 0.75rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: '0.5rem',
          }}
        >
          {infoFor(active)}
        </div>
      )}
    </div>
  )
}