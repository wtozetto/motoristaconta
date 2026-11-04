import type { PlatformFilter, Registro } from '../types'
import { deriveRegistro } from './calculations'
import { formatDateISO } from './format'
import { getCombustiveisList, getCombustivelLitros, getCombustivelValor } from './fuel'

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
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
    'tipoCombustivel',
    'litrosCombustivel',
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
    const valorCombustivel = getCombustivelValor(r.combustivel)
    const litrosCombustivel = getCombustivelLitros(r.combustivel) ?? ''
    const list = getCombustiveisList(r)
    const tipoCombustivel = list.map((c) => c.tipo).join(', ') || 'nao_informado'

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
        valorCombustivel,
        tipoCombustivel,
        litrosCombustivel,
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
