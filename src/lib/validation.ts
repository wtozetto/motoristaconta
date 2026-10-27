import type { RegistroInput } from '../types'

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
  if (!Number.isFinite(input.combustivel) || input.combustivel < 0) {
    errors.push('Combustível não pode ser negativo.')
  }
  const outros = input.outrosGastos ?? 0
  if (!Number.isFinite(outros) || outros < 0) {
    errors.push('Outros gastos não podem ser negativos.')
  }
  return errors
}
