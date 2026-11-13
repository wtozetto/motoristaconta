import { useMemo } from 'react'
import type { ContaFixa, Manutencao } from '../types'
import { todayISO } from '../lib/format'

export interface Lembrete {
  tipo: 'conta' | 'manutencao'
  titulo: string
  status: 'vencido' | 'vence_hoje' | 'proximo' | 'ok'
  mensagem: string
  diasRestantes: number
  id: string
  dataVencimento: string
  valor?: number
}

export function diasAteVencimento(dataVencimento: string, hoje = todayISO()): number {
  if (!isValidISODate(dataVencimento) || !isValidISODate(hoje)) {
    throw new Error('Data de vencimento inválida.')
  }
  const [ano, mes, dia] = dataVencimento.split('-').map(Number)
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number)
  const vencimento = Date.UTC(ano, mes - 1, dia)
  const atual = Date.UTC(anoHoje, mesHoje - 1, diaHoje)
  return Math.round((vencimento - atual) / 86400000)
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function getDueMessage(days: number): Pick<Lembrete, 'status' | 'mensagem'> {
  if (days < 0) {
    const count = Math.abs(days)
    return { status: 'vencido', mensagem: `Vencido há ${count} ${count === 1 ? 'dia' : 'dias'}` }
  }
  if (days === 0) return { status: 'vence_hoje', mensagem: 'Vence hoje' }
  return { status: 'proximo', mensagem: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}` }
}

export function useReminders(
  contasFixas: ContaFixa[],
  manutencoes: Manutencao[],
  alertaDias = 30,
): Lembrete[] {
  const hoje = todayISO()
  return useMemo(() => {
    const lembretes: Lembrete[] = []

    for (const conta of contasFixas) {
      if (conta.status === 'pago') continue
      const days = diasAteVencimento(conta.dataVencimento, hoje)
      if (days > alertaDias) continue
      const due = getDueMessage(days)
      lembretes.push({
        tipo: 'conta',
        titulo: conta.titulo,
        ...due,
        diasRestantes: days,
        id: conta.id,
        dataVencimento: conta.dataVencimento,
        valor: conta.valor,
      })
    }

    for (const manutencao of manutencoes) {
      if (!manutencao.proximaData) continue
      const days = diasAteVencimento(manutencao.proximaData, hoje)
      if (days > alertaDias) continue
      const due = getDueMessage(days)
      lembretes.push({
        tipo: 'manutencao',
        titulo: `${manutencao.categoria}: ${manutencao.descricao}`,
        ...due,
        diasRestantes: days,
        id: manutencao.id,
        dataVencimento: manutencao.proximaData,
      })
    }

    return lembretes.sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [contasFixas, manutencoes, hoje, alertaDias])
}
