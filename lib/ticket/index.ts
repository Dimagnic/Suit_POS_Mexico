export type TicketLine = { label: string; amount: number }

export type TicketData = {
  title: string
  subtitle?: string
  lines: TicketLine[]
  subtotal: number
  tax: number
  total: number
}

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function printTicket(data: TicketData) {
  const win = window.open('', '_blank', 'width=320,height=600')
  if (!win) {
    alert('Tu navegador bloqueo la ventana del ticket. Permite las ventanas emergentes para este sitio e intentalo de nuevo.')
    return
  }

  const rows = data.lines
    .map((l) => '<div class="row"><span>' + esc(l.label) + '</span><span>$' + l.amount.toFixed(2) + '</span></div>')
    .join('')

  const subtitle = data.subtitle ? '<div>' + esc(data.subtitle) + '</div>' : ''

  win.document.write(
    '<html><head><title>Ticket</title><style>' +
      'body{font-family:monospace;width:280px;margin:0 auto;padding:12px;font-size:12px}' +
      'h2{text-align:center;margin:0 0 8px}' +
      'hr{border:none;border-top:1px dashed #000;margin:8px 0}' +
      '.row{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}' +
      '.total{font-weight:bold;margin-top:6px}' +
      '</style></head><body>' +
      '<h2>' + esc(data.title) + '</h2>' +
      subtitle +
      '<div>' + new Date().toLocaleString('es-MX') + '</div><hr />' +
      rows +
      '<hr />' +
      '<div class="row"><span>Subtotal</span><span>$' + data.subtotal.toFixed(2) + '</span></div>' +
      '<div class="row"><span>IVA (16%)</span><span>$' + data.tax.toFixed(2) + '</span></div>' +
      '<div class="row total"><span>TOTAL</span><span>$' + data.total.toFixed(2) + '</span></div><hr />' +
      '<div style="text-align:center">Gracias por su compra!</div>' +
      '</body></html>'
  )
  win.document.close()
  win.focus()

  win.onafterprint = () => {
    win.close()
  }

  win.print()

  setTimeout(() => {
    if (!win.closed) win.close()
  }, 60000)
}