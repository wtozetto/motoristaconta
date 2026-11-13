interface PdfReportData {
  titulo: string
  periodo: string
  resumo: {
    ganhos: number
    gastos: number
    combustivel: number
    manutencao: number
    lucro: number
    km: number
  }
  registros: Array<{
    data: string
    ganhos: number
    gastos: number
    km: number
  }>
  manutencoes?: Array<{
    data: string
    categoria: string
    descricao: string
    valor: number
  }>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function createPrintIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 250)
  }
}

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 24px; }
  .header { background: #059669; color: #fff; padding: 16px 24px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { font-size: 18px; margin: 0; }
  .header p { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 14px; color: #047857; border-bottom: 2px solid #059669; padding-bottom: 4px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #475569; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #fafafa; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-card .label { font-size: 11px; color: #64748b; }
  .summary-card .value { font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 2px; }
  .summary-card.positive .value { color: #16a34a; }
  .summary-card.negative .value { color: #dc2626; }
  .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 0; } .header { border-radius: 0; } }
`

export function exportarRelatorioPDF(data: PdfReportData): void {
  const registrosRows = data.registros
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(formatDate(r.data))}</td>
        <td>${formatBRL(r.ganhos)}</td>
        <td>${formatBRL(r.gastos)}</td>
        <td>${r.km.toFixed(0)} km</td>
      </tr>`,
    )
    .join('')

  const manutencoesSection = data.manutencoes?.length
    ? `
    <div class="section">
      <h2>Manutenções</h2>
      <table>
        <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>
          ${data.manutencoes
            .map(
              (m) => `
            <tr>
              <td>${escapeHtml(formatDate(m.data))}</td>
              <td>${escapeHtml(m.categoria)}</td>
              <td>${escapeHtml(m.descricao)}</td>
              <td>${formatBRL(m.valor)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(data.titulo)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>🚗 MotoristaConta</h1>
    <p>${escapeHtml(data.titulo)} — ${escapeHtml(data.periodo)}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card positive"><div class="label">Ganhos</div><div class="value">${formatBRL(data.resumo.ganhos)}</div></div>
    <div class="summary-card negative"><div class="label">Gastos</div><div class="value">${formatBRL(data.resumo.gastos)}</div></div>
    <div class="summary-card ${data.resumo.lucro >= 0 ? 'positive' : 'negative'}"><div class="label">Lucro</div><div class="value">${formatBRL(data.resumo.lucro)}</div></div>
    <div class="summary-card"><div class="label">Combustível</div><div class="value">${formatBRL(data.resumo.combustivel)}</div></div>
    <div class="summary-card"><div class="label">Manutenção</div><div class="value">${formatBRL(data.resumo.manutencao)}</div></div>
    <div class="summary-card"><div class="label">KM Rodados</div><div class="value">${data.resumo.km.toFixed(0)} km</div></div>
  </div>

  <div class="section">
    <h2>Registros</h2>
    <table>
      <thead><tr><th>Data</th><th>Ganhos</th><th>Gastos</th><th>KM</th></tr></thead>
      <tbody>${registrosRows}</tbody>
    </table>
  </div>

  ${manutencoesSection}

  <div class="footer">Gerado pelo MotoristaConta — ${new Date().toLocaleDateString('pt-BR')}</div>
</body>
</html>`

  createPrintIframe(html)
}

export function exportarHistoricoVeiculoPDF(
  manutencoes: Array<{
    data: string
    categoria: string
    descricao: string
    valor: number
    km: number
    oficina?: string
  }>,
): void {
  const total = manutencoes.reduce((acc, m) => acc + m.valor, 0)

  const rows = manutencoes
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(formatDate(m.data))}</td>
      <td>${escapeHtml(m.categoria)}</td>
      <td>${escapeHtml(m.descricao)}</td>
      <td>${formatBRL(m.valor)}</td>
      <td>${m.km.toFixed(0)} km</td>
      <td>${escapeHtml(m.oficina ?? '—')}</td>
    </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Histórico de Manutenção</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>🚗 MotoristaConta</h1>
    <p>Histórico Completo de Manutenção do Veículo</p>
  </div>

  <div class="summary-grid" style="grid-template-columns: repeat(2, 1fr);">
    <div class="summary-card"><div class="label">Total de Registros</div><div class="value">${manutencoes.length}</div></div>
    <div class="summary-card negative"><div class="label">Valor Total</div><div class="value">${formatBRL(total)}</div></div>
  </div>

  <div class="section">
    <h2>Manutenções</h2>
    <table>
      <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>KM</th><th>Oficina</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="footer">Gerado pelo MotoristaConta — ${new Date().toLocaleDateString('pt-BR')}</div>
</body>
</html>`

  createPrintIframe(html)
}

export function compartilharWhatsApp(texto: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`
  window.open(url, '_blank')
}

export function gerarResumoWhatsApp(
  periodo: string,
  ganhos: number,
  gastos: number,
  lucro: number,
  km: number,
): string {
  return `📊 *MotoristaConta - ${periodo}*\n\n💰 Ganhos: R$ ${ganhos.toFixed(2)}\n💸 Gastos: R$ ${gastos.toFixed(2)}\n✅ Lucro: R$ ${lucro.toFixed(2)}\n🚗 KM: ${km.toFixed(0)}\n\n_Gerado pelo MotoristaConta_`
}

export function exportarListaLembretesPDF(
  lembretes: Array<{ data: string; titulo: string; mensagem: string; valor?: number }>,
): void {
  const rows = lembretes
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(formatDate(item.data))}</td>
      <td>${escapeHtml(item.titulo)}</td>
      <td>${escapeHtml(item.mensagem)}</td>
      <td>${item.valor === undefined ? '—' : formatBRL(item.valor)}</td>
    </tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><title>Lista de lembretes</title><style>${baseStyles}</style></head>
<body>
  <div class="header"><h1>MotoristaConta</h1><p>Lista de lembretes e vencimentos</p></div>
  <div class="section">
    <table>
      <thead><tr><th>Vencimento</th><th>Item</th><th>Status</th><th>Valor</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Nenhum lembrete cadastrado.</td></tr>'}</tbody>
    </table>
  </div>
  <div class="footer">Gerado pelo MotoristaConta — ${new Date().toLocaleDateString('pt-BR')}</div>
</body>
</html>`
  createPrintIframe(html)
}
