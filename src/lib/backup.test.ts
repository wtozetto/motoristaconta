import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type ContaFixa, type Manutencao, type Registro } from '../types'
import {
  applyImport,
  applyImportContasFixas,
  applyImportManutencoes,
  backupToJson,
  parseBackupJson,
} from './backup'

const older: Registro = {
  id: 'same',
  data: '2026-10-01',
  kmInicial: 0,
  kmFinal: 10,
  ganhos: { uber: 10, noventaenove: 0, indrive: 0 },
  combustivel: { tipo: 'gasolina', valor: 50, litros: 8.5 },
  combustiveis: [{ tipo: 'gasolina', valor: 50, litros: 8.5 }],
  outrosGastos: 0,
  observacoes: 'old',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
}

const newer: Registro = {
  ...older,
  observacoes: 'new',
  atualizadoEm: '2026-10-02T10:00:00.000Z',
}

const manutencaoExemplo: Manutencao = {
  id: 'm1',
  data: '2026-10-01',
  categoria: 'Troca de óleo',
  descricao: 'Óleo 5W30 + Filtro',
  valor: 250,
  kmRealizacao: 50000,
  proximaData: '2027-04-01',
  proximaKm: 60000,
  oficina: 'Oficina Central',
  observacoes: 'Garantia',
  status: 'concluido',
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
}

const contaExemplo: ContaFixa = {
  id: 'c1',
  titulo: 'Seguro do carro',
  tipo: 'seguro',
  valor: 250,
  dataVencimento: '2026-10-25',
  observacao: 'Parcela mensal',
  status: 'pendente',
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
}

describe('JSON import/export', () => {
  it('preserva integridade no roundtrip com schema v2 e manutenções', () => {
    const json = backupToJson(
      [older],
      DEFAULT_SETTINGS,
      [manutencaoExemplo],
      '2026-10-14T00:00:00.000Z',
    )
    const parsed = parseBackupJson(json)
    expect(parsed.registros).toEqual([older])
    expect(parsed.manutencoes).toEqual([manutencaoExemplo])
    expect(parsed.settings.reservaPercent).toBe(15)
    expect(parsed.app).toBe('MotoristaConta')
    expect(JSON.parse(json).version).toBe(2)
  })

  it('preserva vencimentos e metas mensais no backup', () => {
    const settings = { ...DEFAULT_SETTINGS, metaMensal: 12000 }
    const json = backupToJson([older], settings, [manutencaoExemplo], undefined, undefined, undefined, [contaExemplo])
    const parsed = parseBackupJson(json)
    expect(parsed.contasFixas).toEqual([contaExemplo])
    expect(parsed.settings.metaMensal).toBe(12000)
  })

  it('preserva categorias personalizadas no backup e lê backups antigos sem categorias', () => {
    const json = backupToJson(
      [older],
      DEFAULT_SETTINGS,
      [manutencaoExemplo],
      undefined,
      undefined,
      undefined,
      [contaExemplo],
      ['Lavagem', 'Pedágio'],
      '2026-10-10T00:00:00.000Z',
    )
    const parsed = parseBackupJson(json)
    expect(parsed.categoriasManutencao).toEqual(['Lavagem', 'Pedágio'])
    expect(parsed.categoriasManutencaoAtualizadoEm).toBe('2026-10-10T00:00:00.000Z')

    const legacy = parseBackupJson(
      JSON.stringify({ settings: DEFAULT_SETTINGS, registros: [] }),
    )
    expect(legacy.categoriasManutencao).toBeUndefined()
  })

  it('migra retrocompativelmente registros antigos com combustivel numérico', () => {
    const legacyRaw = JSON.stringify({
      version: 1,
      app: 'MotoristaConta',
      exportedAt: '2026-10-01T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      registros: [
        {
          id: 'leg1',
          data: '2026-09-01',
          kmInicial: 1000,
          kmFinal: 1200,
          ganhos: { uber: 300, noventaenove: 0, indrive: 0 },
          combustivel: 80,
          outrosGastos: 10,
          observacoes: 'legado',
          atualizadoEm: '2026-09-01T20:00:00.000Z',
        },
      ],
    })

    const parsed = parseBackupJson(legacyRaw)
    expect(parsed.registros).toHaveLength(1)
    const reg = parsed.registros[0]
    expect(reg.combustivel).toEqual({
      tipo: 'nao_informado',
      valor: 80,
      litros: undefined,
    })
    expect(reg.combustiveis).toEqual([
      {
        tipo: 'nao_informado',
        valor: 80,
      },
    ])
    expect(parsed.manutencoes).toEqual([])
  })

  it('no merge, atualizadoEm mais recente vence', () => {
    const merged = applyImport([older], [newer], 'merge')
    expect(merged).toHaveLength(1)
    expect(merged[0].observacoes).toBe('new')
  })

  it('no merge, não sobrescreve com versão mais antiga', () => {
    const merged = applyImport([newer], [older], 'merge')
    expect(merged[0].observacoes).toBe('new')
  })

  it('no merge, inclui ids novos', () => {
    const extra: Registro = { ...older, id: 'other', observacoes: 'extra' }
    const merged = applyImport([older], [extra], 'merge')
    expect(merged.map((r) => r.id).sort()).toEqual(['other', 'same'])
  })

  it('replace descarta os registros atuais', () => {
    const extra: Registro = { ...older, id: 'incoming-only' }
    const replaced = applyImport([older, newer], [extra], 'replace')
    expect(replaced).toEqual([extra])
  })

  it('merge e replace de manutenções', () => {
    const mNewer: Manutencao = {
      ...manutencaoExemplo,
      descricao: 'Descrição atualizada',
      atualizadoEm: '2026-10-05T10:00:00.000Z',
    }
    const merged = applyImportManutencoes([manutencaoExemplo], [mNewer], 'merge')
    expect(merged[0].descricao).toBe('Descrição atualizada')

    const mExtra: Manutencao = { ...manutencaoExemplo, id: 'm2' }
    const replaced = applyImportManutencoes([manutencaoExemplo], [mExtra], 'replace')
    expect(replaced).toEqual([mExtra])
  })

  it('mescla vencimentos pelo timestamp mais recente', () => {
    const updated = { ...contaExemplo, status: 'pago' as const, atualizadoEm: '2026-10-02T10:00:00.000Z' }
    expect(applyImportContasFixas([contaExemplo], [updated], 'merge')[0].status).toBe('pago')
    expect(applyImportContasFixas([contaExemplo], [updated], 'replace')).toEqual([updated])
  })

  it('não quebra com ganhos nulos ou malformados no JSON', () => {
    const raw = JSON.stringify({
      version: 2,
      app: 'MotoristaConta',
      exportedAt: '2026-10-14T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      registros: [
        {
          id: 'r-ganhos-null',
          data: '2026-10-14',
          kmInicial: 10,
          kmFinal: 20,
          ganhos: null,
          combustivel: 0,
          outrosGastos: 0,
          atualizadoEm: '2026-10-14T10:00:00.000Z',
        },
        {
          id: 'r-lixo',
          data: '2026-10-14',
          kmInicial: 'abc',
          ganhos: { uber: 'xyz', noventaenove: -5, indrive: 20 },
          combustivel: { valor: '??' },
          outrosGastos: -3,
          atualizadoEm: '2026-10-14T10:00:00.000Z',
        },
      ],
    })
    const parsed = parseBackupJson(raw)
    expect(parsed.registros[0].ganhos).toEqual({ uber: 0, noventaenove: 0, indrive: 0 })
    expect(parsed.registros[1].kmInicial).toBe(0)
    expect(parsed.registros[1].kmFinal).toBe(0)
    expect(parsed.registros[1].ganhos.uber).toBe(0)
    expect(parsed.registros[1].ganhos.noventaenove).toBe(0)
    expect(parsed.registros[1].ganhos.indrive).toBe(20)
    expect(parsed.registros[1].outrosGastos).toBe(0)
  })

  it('saniza configurações inválidas no backup importado', () => {
    const raw = JSON.stringify({
      version: 2,
      app: 'MotoristaConta',
      exportedAt: '2026-10-14T00:00:00.000Z',
      settings: {
        metaRsPorKm: -4,
        reservaPercent: 250,
        theme: 'neon',
        alertaManutencaoDias: 0,
        alertaManutencaoKm: -10,
      },
      registros: [],
    })
    const parsed = parseBackupJson(raw)
    expect(parsed.settings.metaRsPorKm).toBe(0)
    expect(parsed.settings.reservaPercent).toBe(100)
    expect(parsed.settings.theme).toBe('system')
    expect(parsed.settings.alertaManutencaoDias).toBe(1)
    expect(parsed.settings.alertaManutencaoKm).toBe(0)
  })

  it('saniza valores numéricos inválidos de manutenção', () => {
    const raw = JSON.stringify({
      version: 2,
      app: 'MotoristaConta',
      exportedAt: '2026-10-14T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      registros: [],
      manutencoes: [
        {
          id: 'm-ruim',
          data: '2026-10-14',
          categoria: 'Freios',
          descricao: 'Pastilhas',
          valor: 'sem valor',
          kmRealizacao: 'não sei',
          status: 'concluido',
        },
      ],
    })
    const parsed = parseBackupJson(raw)
    const manutencao = parsed.manutencoes?.[0]
    expect(manutencao?.valor).toBe(0)
    expect(manutencao?.kmRealizacao).toBe(0)
  })
})
