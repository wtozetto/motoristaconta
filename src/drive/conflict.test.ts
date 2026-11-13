import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type BackupPayload, type ContaFixa, type Registro } from '../types'
import { compararESincronizar } from './conflict'

const registro = (id: string, at: string): Registro => ({
  id,
  data: '2026-10-01',
  kmInicial: 0,
  kmFinal: 10,
  ganhos: { uber: 10, noventaenove: 0, indrive: 0 },
  combustivel: 1,
  outrosGastos: 0,
  observacoes: '',
  atualizadoEm: at,
})

const conta: ContaFixa = {
  id: 'bill',
  titulo: 'IPVA',
  tipo: 'ipva',
  valor: 400,
  dataVencimento: '2026-12-01',
  observacao: '',
  status: 'pendente',
  criadoEm: '2026-10-01T00:00:00.000Z',
  atualizadoEm: '2026-10-01T00:00:00.000Z',
}

function payload(
  rows: Registro[],
  exportedAt: string,
  manutencoes?: any[],
): BackupPayload {
  return {
    version: 1,
    app: 'MotoristaConta',
    exportedAt,
    settings: DEFAULT_SETTINGS,
    registros: rows,
    manutencoes,
  } as BackupPayload
}

describe('compararESincronizar', () => {
  const now = '2026-10-10T12:00:00.000Z'

  it('dados locais mais recentes → envia ao Drive', () => {
    const local = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const remote = payload(
      [registro('a', '2026-10-08T09:00:00.000Z')],
      '2026-10-08T09:00:00.000Z',
    )
    const result = compararESincronizar(local, remote, now)
    expect(result.action).toBe('local-applied')
    expect(result.needsRemoteUpload).toBe(true)
    expect(result.needsLocalUpdate).toBe(false)
    expect(result.message).toContain('dados locais estão mais atualizados')
  })

  it('dados do Drive mais recentes → baixar e aplicar', () => {
    const local = payload(
      [registro('a', '2026-10-07T08:00:00.000Z')],
      '2026-10-07T08:00:00.000Z',
    )
    const remote = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(local, remote, now)
    expect(result.action).toBe('remote-applied')
    expect(result.needsLocalUpdate).toBe(true)
    expect(result.needsRemoteUpload).toBe(false)
    expect(result.message).toContain('versão mais recente do Google Drive')
  })

  it('alterações nos dois lados → mesclagem por registro', () => {
    const local = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const remote = payload(
      [registro('b', '2026-10-09T11:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(local, remote, now)
    expect(result.action).toBe('merged')
    expect(result.needsLocalUpdate).toBe(true)
    expect(result.needsRemoteUpload).toBe(true)
    expect(result.message).toContain('Mesclagem realizada')
    const ids = result.mergedRegistros.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('sem diferença → sem ação', () => {
    const p = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(p, p, now)
    expect(result.action).toBe('up-to-date')
    expect(result.needsLocalUpdate).toBe(false)
    expect(result.needsRemoteUpload).toBe(false)
    expect(result.message).toContain('já está atualizado')
  })

  it('ambos vazios → noop', () => {
    const empty = payload([], now)
    const result = compararESincronizar(empty, empty, now)
    expect(result.action).toBe('noop')
  })

  it('local vazio + remoto com dados → remote-applied', () => {
    const local = payload([], now)
    const remote = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(local, remote, now)
    expect(result.action).toBe('remote-applied')
    expect(result.needsLocalUpdate).toBe(true)
  })

  it('remoto null → local-applied', () => {
    const local = payload(
      [registro('a', '2026-10-09T10:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(local, null, now)
    expect(result.action).toBe('local-applied')
    expect(result.needsRemoteUpload).toBe(true)
  })

  it('registro duplicado usa atualizadoEm mais recente', () => {
    const local = payload(
      [registro('x', '2026-10-08T00:00:00.000Z')],
      now,
    )
    const remote = payload(
      [registro('x', '2026-10-09T12:00:00.000Z')],
      now,
    )
    const result = compararESincronizar(local, remote, now)
    expect(result.mergedRegistros).toHaveLength(1)
    expect(result.mergedRegistros[0].atualizadoEm).toBe('2026-10-09T12:00:00.000Z')
  })

  it('sincroniza vencimentos mesmo sem registros ou manutenções', () => {
    const local = { ...payload([], now), contasFixas: [conta] }
    const remote = { ...payload([], now), contasFixas: [] }
    const result = compararESincronizar(local, remote, now)
    expect(result.action).toBe('local-applied')
    expect(result.needsRemoteUpload).toBe(true)
    expect(result.mergedContasFixas).toEqual([conta])
  })
})
