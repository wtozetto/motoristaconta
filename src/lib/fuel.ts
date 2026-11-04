import type {
  CombustivelData,
  CombustivelItem,
  CombustivelTipo,
  Registro,
  RegistroInput,
} from '../types'

export function getCombustivelValor(
  combustivel: CombustivelData | number | undefined,
): number {
  if (typeof combustivel === 'number') {
    return Number.isFinite(combustivel) ? combustivel : 0
  }
  if (combustivel && typeof combustivel === 'object') {
    return Number.isFinite(combustivel.valor) ? combustivel.valor : 0
  }
  return 0
}

export function getCombustivelLitros(
  combustivel: CombustivelData | number | undefined,
): number | undefined {
  if (combustivel && typeof combustivel === 'object' && combustivel.litros !== undefined) {
    return Number.isFinite(combustivel.litros) && combustivel.litros > 0
      ? combustivel.litros
      : undefined
  }
  return undefined
}

export function getCombustiveisList(
  item:
    | {
        combustivel?: CombustivelData | number
        combustiveis?: CombustivelItem[]
      }
    | Registro
    | RegistroInput,
): CombustivelItem[] {
  if (item.combustiveis && Array.isArray(item.combustiveis) && item.combustiveis.length > 0) {
    return item.combustiveis.map((c) => ({
      tipo: c.tipo ?? 'nao_informado',
      valor: Number(c.valor ?? 0),
      litros: c.litros !== undefined && c.litros > 0 ? Number(c.litros) : undefined,
    }))
  }
  if (typeof item.combustivel === 'object' && item.combustivel !== null) {
    const tipo = item.combustivel.tipo === 'multiplo' ? 'nao_informado' : item.combustivel.tipo
    return [
      {
        tipo: tipo ?? 'nao_informado',
        valor: Number(item.combustivel.valor ?? 0),
        litros:
          item.combustivel.litros !== undefined && item.combustivel.litros > 0
            ? Number(item.combustivel.litros)
            : undefined,
      },
    ]
  }
  if (typeof item.combustivel === 'number') {
    return [
      {
        tipo: 'nao_informado',
        valor: Number(item.combustivel ?? 0),
        litros: undefined,
      },
    ]
  }
  return []
}

export function buildCombustivelAggregate(items: CombustivelItem[]): {
  combustivel: CombustivelData
  combustiveis: CombustivelItem[]
} {
  if (!items || items.length === 0) {
    return {
      combustivel: { tipo: 'nao_informado', valor: 0 },
      combustiveis: [],
    }
  }

  const valid = items.filter((i) => i.valor > 0 || (i.litros && i.litros > 0))
  const target = valid.length > 0 ? valid : items.slice(0, 1)

  const totalValor = target.reduce((acc, i) => acc + (Number(i.valor) || 0), 0)
  const totalLitros = target.reduce((acc, i) => acc + (Number(i.litros) || 0), 0)

  const distinctTipos = Array.from(new Set(target.map((i) => i.tipo)))
  const tipo =
    distinctTipos.length === 1
      ? distinctTipos[0]
      : distinctTipos.length > 1
        ? 'multiplo'
        : 'nao_informado'

  return {
    combustivel: {
      tipo,
      valor: totalValor,
      litros: totalLitros > 0 ? totalLitros : undefined,
    },
    combustiveis: target,
  }
}

export interface CombustivelMetrics {
  porTipo: Record<
    CombustivelTipo,
    { valor: number; litros: number; precoMedio: number; kmTotal: number; kmPorLitro: number | null }
  >
  totalValor: number
  totalLitros: number
  custoPorKm: number
}

export function calculateCombustivelMetrics(
  registros: Registro[],
  totalKmGeral: number,
): CombustivelMetrics {
  const porTipo: Record<
    CombustivelTipo,
    { valor: number; litros: number; precoMedio: number; kmTotal: number; kmPorLitro: number | null }
  > = {
    etanol: { valor: 0, litros: 0, precoMedio: 0, kmTotal: 0, kmPorLitro: null },
    gasolina: { valor: 0, litros: 0, precoMedio: 0, kmTotal: 0, kmPorLitro: null },
    diesel: { valor: 0, litros: 0, precoMedio: 0, kmTotal: 0, kmPorLitro: null },
    nao_informado: { valor: 0, litros: 0, precoMedio: 0, kmTotal: 0, kmPorLitro: null },
  }

  for (const reg of registros) {
    const km = Math.max(0, reg.kmFinal - reg.kmInicial)
    const list = getCombustiveisList(reg)
    const totalLitrosDia = list.reduce((sum, item) => sum + (item.litros ?? 0), 0)

    for (const item of list) {
      const t = item.tipo in porTipo ? item.tipo : 'nao_informado'
      porTipo[t].valor += item.valor
      if (item.litros && item.litros > 0) {
        porTipo[t].litros += item.litros
        // Atribui KM proporcional aos litros abastecidos daquele tipo no dia
        const frac = totalLitrosDia > 0 ? item.litros / totalLitrosDia : 1
        porTipo[t].kmTotal += km * frac
      }
    }
  }

  let totalValor = 0
  let totalLitros = 0

  for (const t of ['etanol', 'gasolina', 'diesel', 'nao_informado'] as CombustivelTipo[]) {
    const entry = porTipo[t]
    totalValor += entry.valor
    totalLitros += entry.litros
    if (entry.litros > 0) {
      entry.precoMedio = entry.valor / entry.litros
      entry.kmPorLitro = entry.kmTotal > 0 ? entry.kmTotal / entry.litros : null
    }
  }

  const custoPorKm = totalKmGeral > 0 ? totalValor / totalKmGeral : 0

  return {
    porTipo,
    totalValor,
    totalLitros,
    custoPorKm,
  }
}

