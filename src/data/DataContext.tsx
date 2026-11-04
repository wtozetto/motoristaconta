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
  deleteRegistro,
  listRegistros,
  mergeRegistros,
  replaceAllRegistros,
  upsertRegistro,
} from '../db/database'
import type { Registro, RegistroInput } from '../types'
import { validateRegistro } from '../lib/validation'
import { buildCombustivelAggregate, getCombustiveisList } from '../lib/fuel'

interface DataContextValue {
  registros: Registro[]
  loading: boolean
  saveRegistro: (input: RegistroInput, id?: string) => Promise<void>
  removeRegistro: (id: string) => Promise<void>
  importRegistros: (incoming: Registro[], mode: 'merge' | 'replace') => Promise<void>
  refresh: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await listRegistros()
    setRegistros(rows)
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

  const value = useMemo(
    () => ({
      registros,
      loading,
      saveRegistro,
      removeRegistro,
      importRegistros,
      refresh,
    }),
    [registros, loading, saveRegistro, removeRegistro, importRegistros, refresh],
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
