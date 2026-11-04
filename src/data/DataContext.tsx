import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteManutencao,
  deleteRegistro,
  listManutencoes,
  listRegistros,
  mergeManutencoes,
  mergeRegistros,
  replaceAllManutencoes,
  replaceAllRegistros,
  upsertManutencao,
  upsertRegistro,
} from '../db/database'
import type {
  Manutencao,
  ManutencaoInput,
  Registro,
  RegistroInput,
} from '../types'
import { validateManutencao, validateRegistro } from '../lib/validation'
import { buildCombustivelAggregate, getCombustiveisList } from '../lib/fuel'

interface DataContextValue {
  registros: Registro[]
  manutencoes: Manutencao[]
  loading: boolean
  saveRegistro: (input: RegistroInput, id?: string) => Promise<void>
  removeRegistro: (id: string) => Promise<void>
  importRegistros: (incoming: Registro[], mode: 'merge' | 'replace') => Promise<void>
  saveManutencao: (input: ManutencaoInput, id?: string) => Promise<void>
  removeManutencao: (id: string) => Promise<void>
  importManutencoes: (incoming: Manutencao[], mode: 'merge' | 'replace') => Promise<void>
  refresh: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [rowsRegistros, rowsManutencoes] = await Promise.all([
      listRegistros(),
      listManutencoes(),
    ])
    setRegistros(rowsRegistros)
    setManutencoes(rowsManutencoes)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveRegistro = useCallback(
    async (input: RegistroInput, id?: string) => {
      const errors = validateRegistro(input)
      if (errors.length > 0) {
        throw new Error(errors.join(' '))
      }

      let combustivel = input.combustivel
      let combustiveis = input.combustiveis

      if (combustiveis && combustiveis.length > 0) {
        const agg = buildCombustivelAggregate(combustiveis)
        combustivel = agg.combustivel
        combustiveis = agg.combustiveis
      } else if (typeof combustivel === 'number') {
        combustivel = { tipo: 'nao_informado', valor: combustivel }
        combustiveis = [{ tipo: 'nao_informado', valor: combustivel.valor }]
      } else if (typeof combustivel === 'object' && combustivel !== null) {
        combustiveis = getCombustiveisList(input)
      }

      const registro: Registro = {
        id: id ?? crypto.randomUUID(),
        data: input.data,
        kmInicial: input.kmInicial,
        kmFinal: input.kmFinal,
        ganhos: { ...input.ganhos },
        combustivel,
        combustiveis,
        outrosGastos: input.outrosGastos ?? 0,
        observacoes: input.observacoes ?? '',
        atualizadoEm: new Date().toISOString(),
      }
      await upsertRegistro(registro)
      await refresh()
    },
    [refresh],
  )

  const removeRegistro = useCallback(
    async (id: string) => {
      await deleteRegistro(id)
      await refresh()
    },
    [refresh],
  )

  const importRegistros = useCallback(
    async (incoming: Registro[], mode: 'merge' | 'replace') => {
      if (mode === 'replace') {
        await replaceAllRegistros(incoming)
      } else {
        await mergeRegistros(incoming)
      }
      await refresh()
    },
    [refresh],
  )

  const saveManutencao = useCallback(
    async (input: ManutencaoInput, id?: string) => {
      const errors = validateManutencao(input)
      if (errors.length > 0) {
        throw new Error(errors.join(' '))
      }
      const now = new Date().toISOString()
      const existing = id ? manutencoes.find((m) => m.id === id) : undefined

      const manutencao: Manutencao = {
        id: id ?? crypto.randomUUID(),
        data: input.data,
        categoria: input.categoria,
        descricao: input.descricao.trim(),
        valor: Number(input.valor),
        kmRealizacao: Number(input.kmRealizacao),
        proximaData: input.proximaData?.trim() || undefined,
        proximaKm:
          input.proximaKm !== undefined &&
          input.proximaKm !== null &&
          !isNaN(Number(input.proximaKm))
            ? Number(input.proximaKm)
            : undefined,
        oficina: input.oficina?.trim() || undefined,
        observacoes: input.observacoes?.trim() || undefined,
        status: input.status,
        criadoEm: existing?.criadoEm ?? now,
        atualizadoEm: now,
      }
      await upsertManutencao(manutencao)
      await refresh()
    },
    [manutencoes, refresh],
  )

  const removeManutencao = useCallback(
    async (id: string) => {
      await deleteManutencao(id)
      await refresh()
    },
    [refresh],
  )

  const importManutencoes = useCallback(
    async (incoming: Manutencao[], mode: 'merge' | 'replace') => {
      if (mode === 'replace') {
        await replaceAllManutencoes(incoming)
      } else {
        await mergeManutencoes(incoming)
      }
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      registros,
      manutencoes,
      loading,
      saveRegistro,
      removeRegistro,
      importRegistros,
      saveManutencao,
      removeManutencao,
      importManutencoes,
      refresh,
    }),
    [
      registros,
      manutencoes,
      loading,
      saveRegistro,
      removeRegistro,
      importRegistros,
      saveManutencao,
      removeManutencao,
      importManutencoes,
      refresh,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useData precisa estar dentro de DataProvider')
  }
  return ctx
}
