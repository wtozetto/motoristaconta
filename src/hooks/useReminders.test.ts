import { describe, expect, it } from 'vitest'
import { diasAteVencimento, getDueMessage } from './useReminders'

describe('reminder due dates', () => {
  it('calculates upcoming, due-today, and overdue days without timezone drift', () => {
    expect(diasAteVencimento('2026-03-01', '2026-02-28')).toBe(1)
    expect(diasAteVencimento('2026-02-28', '2026-02-28')).toBe(0)
    expect(diasAteVencimento('2026-02-27', '2026-02-28')).toBe(-1)
  })

  it('formats urgency states, including the singular day', () => {
    expect(getDueMessage(-1)).toEqual({ status: 'vencido', mensagem: 'Vencido há 1 dia' })
    expect(getDueMessage(0)).toEqual({ status: 'vence_hoje', mensagem: 'Vence hoje' })
    expect(getDueMessage(1)).toEqual({ status: 'proximo', mensagem: 'Vence em 1 dia' })
  })

  it('rejects invalid calendar dates', () => {
    expect(() => diasAteVencimento('2026-02-30', '2026-02-28')).toThrow('Data de vencimento inválida')
  })
})
