import type {
  DerivedMetrics,
  Ganhos,
  PlatformFilter,
  PlatformKey,
  Registro,
} from '../types'

function perKm(value: number, km: number): number {
  if (km === 0) return 0
  return value / km
}

export function ganhosFiltrados(ganhos: Ganhos, filter: PlatformFilter): number {
  if (filter === 'todas') {
    return ganhos.uber + ganhos.noventaenove + ganhos.indrive
  }
  return ganhos[filter]
}

export function totalGanhosPlataformas(ganhos: Ganhos): number {
  return ganhos.uber + ganhos.noventaenove + ganhos.indrive
}

export function deriveRegistro(
  registro: Registro,
  filter: PlatformFilter = 'todas',
): DerivedMetrics {
  const km = registro.kmFinal - registro.kmInicial
  const totalGanhos = ganhosFiltrados(registro.ganhos, filter)
  const totalGastos = registro.combustivel + (registro.outrosGastos ?? 0)
  const lucroLiquido = totalGanhos - totalGastos
  const fullGanhos = totalGanhosPlataformas(registro.ganhos)
  const shares: Ganhos = {
    uber: fullGanhos === 0 ? 0 : registro.ganhos.uber / fullGanhos,
    noventaenove: fullGanhos === 0 ? 0 : registro.ganhos.noventaenove / fullGanhos,
    indrive: fullGanhos === 0 ? 0 : registro.ganhos.indrive / fullGanhos,
  }
  return {
    km,
    totalGanhos,
    totalGastos,
    lucroLiquido,
    mediaGanhoPorKm: perKm(totalGanhos, km),
    custoPorKm: perKm(totalGastos, km),
    lucroPorKm: perKm(lucroLiquido, km),
    shares,
  }
}

export function emptyGanhos(): Ganhos {
  return { uber: 0, noventaenove: 0, indrive: 0 }
}

export function sumGanhos(items: Ganhos[]): Ganhos {
  return items.reduce<Ganhos>(
    (acc, g) => ({
      uber: acc.uber + g.uber,
      noventaenove: acc.noventaenove + g.noventaenove,
      indrive: acc.indrive + g.indrive,
    }),
    emptyGanhos(),
  )
}

export function aggregateRegistros(
  registros: Registro[],
  filter: PlatformFilter = 'todas',
): DerivedMetrics & { count: number; ganhosPorPlataforma: Ganhos } {
  const ganhosPorPlataforma = sumGanhos(registros.map((r) => r.ganhos))
  const totals = registros.reduce(
    (acc, r) => {
      const d = deriveRegistro(r, filter)
      acc.km += d.km
      acc.totalGanhos += d.totalGanhos
      acc.totalGastos += d.totalGastos
      acc.lucroLiquido += d.lucroLiquido
      return acc
    },
    { km: 0, totalGanhos: 0, totalGastos: 0, lucroLiquido: 0 },
  )
  const fullGanhos = totalGanhosPlataformas(ganhosPorPlataforma)
  return {
    ...totals,
    mediaGanhoPorKm: perKm(totals.totalGanhos, totals.km),
    custoPorKm: perKm(totals.totalGastos, totals.km),
    lucroPorKm: perKm(totals.lucroLiquido, totals.km),
    shares: {
      uber: fullGanhos === 0 ? 0 : ganhosPorPlataforma.uber / fullGanhos,
      noventaenove:
        fullGanhos === 0 ? 0 : ganhosPorPlataforma.noventaenove / fullGanhos,
      indrive: fullGanhos === 0 ? 0 : ganhosPorPlataforma.indrive / fullGanhos,
    },
    count: registros.length,
    ganhosPorPlataforma,
  }
}

export function trendDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export const PLATFORM_KEYS: PlatformKey[] = ['uber', 'noventaenove', 'indrive']
