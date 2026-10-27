import type { AppSettings, PlatformFilter, PlatformKey, Registro } from '../types'
import { PLATFORM_LABEL } from '../types'
import { aggregateRegistros, PLATFORM_KEYS } from './calculations'
import { parseISODate, WEEKDAY_LABELS } from './periods'

export const HIGH_COST_RATIO = 0.3

export interface TipsEvaluation {
  highCost: boolean
  costRatio: number
  bestWeekday: number | null
  bestWeekdayLucro: number
  topPlatform: PlatformKey | null
  platformRank: { key: PlatformKey; ganhos: number }[]
  actualMediaPorKm: number
  metaRsPorKm: number
  metaStatus: 'above' | 'below' | 'equal' | 'n/a'
  suggestedReserve: number
  lucroLiquido: number
  canCoverReserve: boolean
  reservaPercent: number
}

export interface TipCardModel {
  id: keyof Pick<
    TipsEvaluation,
    'highCost' | 'bestWeekday' | 'topPlatform' | 'metaStatus' | 'suggestedReserve'
  > | 'custo-alto' | 'melhor-dia' | 'plataforma' | 'meta' | 'reserva'
  title: string
  body: string
  tone: 'warning' | 'info' | 'success'
}

export function evaluateTips(
  registros: Registro[],
  settings: AppSettings,
  filter: PlatformFilter = 'todas',
): TipsEvaluation {
  const agg = aggregateRegistros(registros, filter)
  const costRatio = agg.totalGanhos === 0 ? 0 : agg.totalGastos / agg.totalGanhos
  const highCost = agg.totalGanhos > 0 && costRatio > HIGH_COST_RATIO

  const byWeekday = new Map<number, number>()
  for (const r of registros) {
    const weekday = parseISODate(r.data).getDay()
    const lucro = aggregateRegistros([r], filter).lucroLiquido
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + lucro)
  }
  let bestWeekday: number | null = null
  let bestWeekdayLucro = Number.NEGATIVE_INFINITY
  for (const [day, lucro] of byWeekday) {
    if (lucro > bestWeekdayLucro) {
      bestWeekday = day
      bestWeekdayLucro = lucro
    }
  }
  if (registros.length === 0) {
    bestWeekday = null
    bestWeekdayLucro = 0
  }

  const platformRank = PLATFORM_KEYS.map((key) => ({
    key,
    ganhos: agg.ganhosPorPlataforma[key],
  })).sort((a, b) => b.ganhos - a.ganhos)
  const topPlatform =
    platformRank[0] && platformRank[0].ganhos > 0 ? platformRank[0].key : null

  const metaRsPorKm = settings.metaRsPorKm
  let metaStatus: TipsEvaluation['metaStatus'] = 'n/a'
  if (metaRsPorKm > 0 && agg.km > 0) {
    if (agg.mediaGanhoPorKm > metaRsPorKm) metaStatus = 'above'
    else if (agg.mediaGanhoPorKm < metaRsPorKm) metaStatus = 'below'
    else metaStatus = 'equal'
  }

  const reservaPercent = settings.reservaPercent ?? 15
  const suggestedReserve = agg.totalGanhos * (reservaPercent / 100)

  return {
    highCost,
    costRatio,
    bestWeekday,
    bestWeekdayLucro: bestWeekday === null ? 0 : bestWeekdayLucro,
    topPlatform,
    platformRank,
    actualMediaPorKm: agg.mediaGanhoPorKm,
    metaRsPorKm,
    metaStatus,
    suggestedReserve,
    lucroLiquido: agg.lucroLiquido,
    canCoverReserve: agg.lucroLiquido >= suggestedReserve,
    reservaPercent,
  }
}

export function buildTips(
  registros: Registro[],
  settings: AppSettings,
  filter: PlatformFilter = 'todas',
): TipCardModel[] {
  const e = evaluateTips(registros, settings, filter)
  const tips: TipCardModel[] = []

  if (e.highCost) {
    tips.push({
      id: 'custo-alto',
      title: 'Custo de combustível e gastos alto',
      body: `Gastos representam ${(e.costRatio * 100).toFixed(1)}% dos ganhos (acima de 30%). Vale revisar combustível, ociosidade e outros custos.`,
      tone: 'warning',
    })
  }

  if (e.bestWeekday !== null) {
    tips.push({
      id: 'melhor-dia',
      title: 'Melhor dia da semana',
      body: `Seu melhor resultado líquido foi em ${WEEKDAY_LABELS[e.bestWeekday]}. Concentrar mais horas nesse dia pode melhorar a média.`,
      tone: 'info',
    })
  }

  if (e.topPlatform) {
    const [, second] = e.platformRank
    const secondText =
      second && second.ganhos > 0
        ? ` Em seguida: ${PLATFORM_LABEL[second.key]}.`
        : ''
    tips.push({
      id: 'plataforma',
      title: 'Comparação de aplicativos',
      body: `${PLATFORM_LABEL[e.topPlatform]} liderou os ganhos no período.${secondText}`,
      tone: 'info',
    })
  }

  if (e.metaStatus !== 'n/a') {
    const actual = e.actualMediaPorKm.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const meta = e.metaRsPorKm.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    if (e.metaStatus === 'below') {
      tips.push({
        id: 'meta',
        title: 'Meta de R$/km abaixo',
        body: `Média atual ${actual}/km, meta ${meta}/km. Ajuste mix de corridas ou custos para alcançar a meta.`,
        tone: 'warning',
      })
    } else {
      tips.push({
        id: 'meta',
        title: 'Meta de R$/km atingida',
        body: `Média atual ${actual}/km está na meta de ${meta}/km.`,
        tone: 'success',
      })
    }
  }

  const suggested = e.suggestedReserve.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
  const lucro = e.lucroLiquido.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
  tips.push({
    id: 'reserva',
    title: `Reserva de ${e.reservaPercent}%`,
    body: e.canCoverReserve
      ? `Reserva sugerida acumulada ${suggested}. O lucro líquido (${lucro}) cobre essa reserva.`
      : `Reserva sugerida acumulada ${suggested}. O lucro líquido (${lucro}) ainda não cobre o percentual definido.`,
    tone: e.canCoverReserve ? 'success' : 'warning',
  })

  return tips
}
