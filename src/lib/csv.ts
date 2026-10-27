import type { PlatformFilter, Registro } from '../types'
import { deriveRegistro } from './calculations'
import { formatDateISO } from './format'

function escapeCsv(value: string | number): string {
  const text = String(value)
  if (/[",;\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function registrosToCsv(
  registros: Registro[],
  filter: PlatformFilter = 'todas',
): string {
  const header = [
    'id',
    'data',
    'kmInicial',
    'kmFinal',
    'km',
    'uber',
    '99',
    'indrive',
    'ganhosConsiderados',
    'combustivel',
    'outrosGastos',
    'totalGastos',
    'lucroLiquido',
    'mediaGanhoPorKm',
    'custoPorKm',
    'lucroPorKm',
    'observacoes',
  ]
  const lines = [header.join(';')]
  for (const r of registros) {
    const d = deriveRegistro(r, filter)
    lines.push(
      [
        r.id,
        formatDateISO(r.data),
        r.kmInicial,
        r.kmFinal,
        d.km,
        r.ganhos.uber,
        r.ganhos.noventaenove,
        r.ganhos.indrive,
        d.totalGanhos,
        r.combustivel,
        r.outrosGastos ?? 0,
        d.totalGastos,
        d.lucroLiquido,
        d.mediaGanhoPorKm,
        d.custoPorKm,
        d.lucroPorKm,
        r.observacoes,
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJsonBackup(filename: string, json: string): void {
  downloadTextFile(filename, json, 'application/json;charset=utf-8')
}
