import type {
  AppSettings,
  Manutencao,
  ManutencaoAlerta,
  Registro,
} from '../types'
import { todayISO } from './format'

export function getKmAtual(registros: Registro[], manutencoes: Manutencao[] = []): number {
  let maxKm = 0
  for (const r of registros) {
    if (r.kmFinal > maxKm) maxKm = r.kmFinal
  }
  if (maxKm === 0) {
    for (const m of manutencoes) {
      if (m.kmRealizacao > maxKm) maxKm = m.kmRealizacao
    }
  }
  return maxKm
}

function parseDateOnly(isoString: string): Date {
  const [y, m, d] = isoString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diffDays(targetIso: string, fromIso: string): number {
  const target = parseDateOnly(targetIso).getTime()
  const from = parseDateOnly(fromIso).getTime()
  return Math.round((target - from) / (1000 * 60 * 60 * 24))
}

export function evaluateManutencaoAlerta(
  manutencao: Manutencao,
  kmAtual: number,
  settings: AppSettings,
  today: string = todayISO(),
): ManutencaoAlerta {
  const diasAlerta = settings.alertaManutencaoDias ?? 30
  const kmAlerta = settings.alertaManutencaoKm ?? 500

  const proximaData = manutencao.proximaData?.trim() || undefined
  const proximaKm =
    manutencao.proximaKm !== undefined && manutencao.proximaKm !== null && !isNaN(manutencao.proximaKm)
      ? manutencao.proximaKm
      : undefined

  let diasRestantes: number | undefined
  let isDataAtrasada = false
  let isDataProxima = false

  if (proximaData) {
    diasRestantes = diffDays(proximaData, today)
    if (diasRestantes < 0) {
      isDataAtrasada = true
    } else if (diasRestantes <= diasAlerta) {
      isDataProxima = true
    }
  }

  let kmRestantes: number | undefined
  let isKmAtrasado = false
  let isKmProximo = false

  if (proximaKm !== undefined) {
    kmRestantes = proximaKm - kmAtual
    if (kmRestantes <= 0) {
      isKmAtrasado = true
    } else if (kmRestantes <= kmAlerta) {
      isKmProximo = true
    }
  }

  // 🔴 Atrasado: data < hoje OU km atual >= kmPróxima
  if (isDataAtrasada || isKmAtrasado) {
    const motivos: string[] = []
    if (isDataAtrasada && diasRestantes !== undefined) {
      motivos.push(`venceu há ${Math.abs(diasRestantes)} dia(s) (${proximaData})`)
    }
    if (isKmAtrasado && kmRestantes !== undefined) {
      motivos.push(`ultrapassou ${Math.abs(kmRestantes)} km (limite: ${proximaKm?.toLocaleString('pt-BR')} km)`)
    }
    return {
      manutencao,
      status: 'atrasado',
      mensagem: 'Manutenção atrasada!',
      detalhe: motivos.join(' e '),
      diasRestantes,
      kmRestantes,
    }
  }

  // 🟡 Próximo: data <= hoje + diasAlerta OU km atual >= kmPróxima - kmAlerta
  if (isDataProxima || isKmProximo) {
    const motivos: string[] = []
    if (isDataProxima && diasRestantes !== undefined) {
      motivos.push(`faltam ${diasRestantes} dia(s) (${proximaData})`)
    }
    if (isKmProximo && kmRestantes !== undefined) {
      motivos.push(`faltam ${kmRestantes.toLocaleString('pt-BR')} km`)
    }
    return {
      manutencao,
      status: 'proximo',
      mensagem: 'Atenção: manutenção próxima',
      detalhe: motivos.join(' e '),
      diasRestantes,
      kmRestantes,
    }
  }

  // 🟢 Ok
  const info: string[] = []
  if (diasRestantes !== undefined) {
    info.push(`faltam ${diasRestantes} dia(s)`)
  }
  if (kmRestantes !== undefined) {
    info.push(`faltam ${kmRestantes.toLocaleString('pt-BR')} km`)
  }
  return {
    manutencao,
    status: 'ok',
    mensagem: 'Manutenção em dia',
    detalhe: info.length > 0 ? info.join(' / ') : undefined,
    diasRestantes,
    kmRestantes,
  }
}

export function getAllManutencaoAlertas(
  manutencoes: Manutencao[],
  kmAtual: number,
  settings: AppSettings,
  today: string = todayISO(),
): ManutencaoAlerta[] {
  const alertas = manutencoes.map((m) =>
    evaluateManutencaoAlerta(m, kmAtual, settings, today),
  )

  const priorityOrder = { atrasado: 0, proximo: 1, ok: 2 }

  return alertas.sort((a, b) => {
    const diff = priorityOrder[a.status] - priorityOrder[b.status]
    if (diff !== 0) return diff
    // secundário: por data de realização decrescente
    return b.manutencao.data.localeCompare(a.manutencao.data)
  })
}

export interface ManutencaoMetrics {
  totalGasto: number
  totalItens: number
  porCategoria: Record<string, number>
  atrasadasCount: number
  proximasCount: number
}

export function calculateManutencaoMetrics(
  manutencoes: Manutencao[],
  kmAtual: number,
  settings: AppSettings,
): ManutencaoMetrics {
  let totalGasto = 0
  const porCategoria: Record<string, number> = {}

  for (const m of manutencoes) {
    totalGasto += m.valor
    porCategoria[m.categoria] = (porCategoria[m.categoria] ?? 0) + m.valor
  }

  const alertas = getAllManutencaoAlertas(manutencoes, kmAtual, settings)
  const atrasadasCount = alertas.filter((a) => a.status === 'atrasado').length
  const proximasCount = alertas.filter((a) => a.status === 'proximo').length

  return {
    totalGasto,
    totalItens: manutencoes.length,
    porCategoria,
    atrasadasCount,
    proximasCount,
  }
}
