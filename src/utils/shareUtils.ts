export interface ReportSummary {
  periodo: string
  ganhos: number
  gastos: number
  manutencao: number
  lucro: number
  km: number
}

export function gerarResumoRelatorio(summary: ReportSummary): string {
  const money = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return [
    `MotoristaConta — ${summary.periodo}`,
    `Ganhos: ${money(summary.ganhos)}`,
    `Gastos operacionais: ${money(summary.gastos)}`,
    `Manutenção: ${money(summary.manutencao)}`,
    `Lucro: ${money(summary.lucro)}`,
    `Quilometragem: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(summary.km)} km`,
  ].join('\n')
}

export async function copiarResumoRelatorio(summary: ReportSummary): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('A cópia para a área de transferência não está disponível neste navegador.')
  }
  await navigator.clipboard.writeText(gerarResumoRelatorio(summary))
}
