import type { ManutencaoInput, RegistroInput } from '../types'
import { getCombustivelValor } from './fuel'

export function validateRegistro(input: RegistroInput): string[] {
  const errors: string[] = []
  if (!input.data || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    errors.push('Informe uma data válida.')
  }
  if (!Number.isFinite(input.kmInicial) || input.kmInicial < 0) {
    errors.push('KM inicial não pode ser negativo.')
  }
  if (!Number.isFinite(input.kmFinal) || input.kmFinal < 0) {
    errors.push('KM final não pode ser negativo.')
  }
  if (input.kmFinal < input.kmInicial) {
    errors.push('KM final não pode ser menor que o KM inicial.')
  }
  const { uber, noventaenove, indrive } = input.ganhos
  if (uber < 0 || noventaenove < 0 || indrive < 0) {
    errors.push('Ganhos não podem ser negativos.')
  }

  if (input.combustiveis && input.combustiveis.length > 0) {
    for (const item of input.combustiveis) {
      if (!Number.isFinite(item.valor) || item.valor < 0) {
        errors.push('Combustível não pode ser negativo.')
      }
      if (item.litros !== undefined && (!Number.isFinite(item.litros) || item.litros < 0)) {
        errors.push('Litros de combustível não podem ser negativos.')
      }
      if (item.valor > 0 && (!item.tipo || item.tipo === 'nao_informado')) {
        errors.push('Selecione o tipo de combustível (Etanol, Gasolina ou Diesel).')
      }
    }
  } else if (typeof input.combustivel === 'object' && input.combustivel !== null) {
    const { valor, tipo, litros } = input.combustivel
    if (!Number.isFinite(valor) || valor < 0) {
      errors.push('Combustível não pode ser negativo.')
    }
    if (litros !== undefined && (!Number.isFinite(litros) || litros < 0)) {
      errors.push('Litros de combustível não podem ser negativos.')
    }
    if (valor > 0 && (!tipo || tipo === 'nao_informado')) {
      errors.push('Selecione o tipo de combustível (Etanol, Gasolina ou Diesel).')
    }
  } else {
    const valor = getCombustivelValor(input.combustivel)
    if (!Number.isFinite(valor) || valor < 0) {
      errors.push('Combustível não pode ser negativo.')
    }
  }

  const outros = input.outrosGastos ?? 0
  if (!Number.isFinite(outros) || outros < 0) {
    errors.push('Outros gastos não podem ser negativos.')
  }
  return errors
}

export function validateManutencao(input: ManutencaoInput): string[] {
  const errors: string[] = []
  if (!input.data || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    errors.push('Informe uma data válida de realização.')
  }
  if (!input.categoria || !input.categoria.trim()) {
    errors.push('Selecione uma categoria para o serviço.')
  }
  if (!input.descricao || !input.descricao.trim()) {
    errors.push('Informe a descrição do serviço realizado.')
  }
  if (!Number.isFinite(input.valor) || input.valor < 0) {
    errors.push('Valor total da manutenção não pode ser negativo.')
  }
  if (!Number.isFinite(input.kmRealizacao) || input.kmRealizacao < 0) {
    errors.push('KM de realização não pode ser negativo.')
  }

  const hasData = Boolean(input.proximaData && input.proximaData.trim())
  const hasKm =
    input.proximaKm !== undefined &&
    input.proximaKm !== null &&
    Number.isFinite(input.proximaKm)

  if (!hasData && !hasKm) {
    errors.push('Informe a data ou o KM da próxima manutenção (pelo menos um para gerar alertas).')
  }

  if (hasData && !/^\d{4}-\d{2}-\d{2}$/.test(input.proximaData!)) {
    errors.push('Informe uma data válida para a próxima manutenção.')
  }

  if (hasKm && input.proximaKm! <= input.kmRealizacao) {
    errors.push('O KM da próxima manutenção deve ser maior que o KM de realização.')
  }

  return errors
}

