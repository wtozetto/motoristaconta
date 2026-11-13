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
  deleteContaFixa,
  deleteManutencao,
  deleteRegistro,
  listContasFixas,
  listCategoriasManutencao,
  listManutencoes,
  listRegistros,
  mergeContasFixas,
  mergeManutencoes,
  mergeRegistros,
  replaceAllContasFixas,
  replaceAllManutencoes,
  replaceAllRegistros,
  replaceCategoriasManutencao,
  upsertContaFixa,
  upsertManutencao,
  upsertRegistro,
} from '../db/database'
import type {
  ContaFixa,
  ContaFixaInput,
  Manutencao,
  ManutencaoInput,
  Registro,
  RegistroInput,
} from '../types'
import { validateManutencao, validateRegistro } from '../lib/validation'
import { buildCombustivelAggregate, getCombustiveisList } from '../lib/fuel'
import { getLatestRecordStamp } from '../lib/backup'
import {
  getLocalModificacaoStamp,
  setLocalModificacaoStamp,
  setLocalCategoriasManutencaoStamp,
} from '../drive/syncStorage'

interface DataContextValue {
  registros: Registro[]
  manutencoes: Manutencao[]
  contasFixas: ContaFixa[]
  categoriasManutencao: string[]
  loading: boolean
  ultimaModificacao: string
  saveRegistro: (input: RegistroInput, id?: string) => Promise<void>
  removeRegistro: (id: string) => Promise<void>
  importRegistros: (incoming: Registro[], mode: 'merge' | 'replace') => Promise<void>
  saveManutencao: (input: ManutencaoInput, id?: string) => Promise<void>
  removeManutencao: (id: string) => Promise<void>
  importManutencoes: (incoming: Manutencao[], mode: 'merge' | 'replace') => Promise<void>
  saveContaFixa: (input: ContaFixaInput, id?: string) => Promise<void>
  removeContaFixa: (id: string) => Promise<void>
  importContasFixas: (incoming: ContaFixa[], mode: 'merge' | 'replace') => Promise<void>
  saveCategoriaManutencao: (nome: string, nomeAnterior?: string) => Promise<void>
  removeCategoriaManutencao: (nome: string) => Promise<void>
  importCategoriasManutencao: (
    incoming: string[],
    mode: 'merge' | 'replace',
    atualizadoEm?: string,
  ) => Promise<void>
  refresh: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [contasFixas, setContasFixas] = useState<ContaFixa[]>([])
  const [categoriasManutencao, setCategoriasManutencao] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [ultimaModificacao, setUltimaModificacaoState] = useState<string>(getLocalModificacaoStamp())

  const refresh = useCallback(async () => {
    const [rowsRegistros, rowsManutencoes, rowsContasFixas, rowsCategorias] = await Promise.all([
      listRegistros(),
      listManutencoes(),
      listContasFixas(),
      listCategoriasManutencao(),
    ])
    setRegistros(rowsRegistros)
    setManutencoes(rowsManutencoes)
    setContasFixas(rowsContasFixas)
    setCategoriasManutencao(rowsCategorias)

    let currentMod = getLocalModificacaoStamp()
    if (!currentMod) {
      const maxStamp = getLatestRecordStamp({
        registros: rowsRegistros,
        manutencoes: rowsManutencoes,
        contasFixas: rowsContasFixas,
      })
      if (maxStamp) {
        setLocalModificacaoStamp(maxStamp)
        currentMod = maxStamp
      }
    }
    setUltimaModificacaoState(currentMod)
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

      const now = new Date().toISOString()
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
        atualizadoEm: now,
      }
      await upsertRegistro(registro)
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [refresh],
  )

  const removeRegistro = useCallback(
    async (id: string) => {
      const now = new Date().toISOString()
      await deleteRegistro(id)
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
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
      // A importação muda os dados locais; atualiza o carimbo para que a
      // próxima sincronização não considere o Drive mais recente e sobrescreva
      // os registros recém-importados.
      const now = new Date().toISOString()
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
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
        seguroSubcategoria: input.seguroSubcategoria,
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
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [manutencoes, refresh],
  )

  const removeManutencao = useCallback(
    async (id: string) => {
      const now = new Date().toISOString()
      await deleteManutencao(id)
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
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
      const now = new Date().toISOString()
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [refresh],
  )

  const saveContaFixa = useCallback(async (input: ContaFixaInput, id?: string) => {
    const title = input.titulo.trim()
    const date = new Date(`${input.dataVencimento}T00:00:00Z`)
    if (!title) throw new Error('Informe o título do vencimento.')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dataVencimento) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input.dataVencimento
    ) {
      throw new Error('Informe uma data de vencimento válida.')
    }
    if (!Number.isFinite(input.valor) || input.valor < 0) {
      throw new Error('O valor não pode ser negativo.')
    }
    const now = new Date().toISOString()
    await upsertContaFixa({
      id: id ?? crypto.randomUUID(),
      titulo: title,
      tipo: input.tipo,
      valor: Number(input.valor),
      dataVencimento: input.dataVencimento,
      observacao: input.observacao?.trim() ?? '',
      status: input.status,
      criadoEm: id ? contasFixas.find((conta) => conta.id === id)?.criadoEm ?? now : now,
      atualizadoEm: now,
    })
    setLocalModificacaoStamp(now)
    setUltimaModificacaoState(now)
    await refresh()
  }, [contasFixas, refresh])

  const removeContaFixa = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    await deleteContaFixa(id)
    setLocalModificacaoStamp(now)
    setUltimaModificacaoState(now)
    await refresh()
  }, [refresh])

  const importContasFixas = useCallback(
    async (incoming: ContaFixa[], mode: 'merge' | 'replace') => {
      if (mode === 'replace') await replaceAllContasFixas(incoming)
      else await mergeContasFixas(incoming)
      const now = new Date().toISOString()
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [refresh],
  )

  const saveCategoriaManutencao = useCallback(
    async (nome: string, nomeAnterior?: string) => {
      const trimmed = nome.trim()
      if (!trimmed) throw new Error('Informe o nome da categoria.')
      if (trimmed.length > 50) throw new Error('A categoria deve ter no máximo 50 caracteres.')
      const current = categoriasManutencao.filter((item) => item !== nomeAnterior)
      if (current.some((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
        throw new Error('Já existe uma categoria com esse nome.')
      }
      const next = [...current, trimmed].sort((a, b) => a.localeCompare(b))
      const now = new Date().toISOString()
      await replaceCategoriasManutencao(next)
      setLocalCategoriasManutencaoStamp(now)
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [categoriasManutencao, refresh],
  )

  const removeCategoriaManutencao = useCallback(
    async (nome: string) => {
      const next = categoriasManutencao.filter((item) => item !== nome)
      const now = new Date().toISOString()
      await replaceCategoriasManutencao(next)
      setLocalCategoriasManutencaoStamp(now)
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [categoriasManutencao, refresh],
  )

  const importCategoriasManutencao = useCallback(
    async (incoming: string[], mode: 'merge' | 'replace', atualizadoEm?: string) => {
      const next =
        mode === 'replace'
          ? incoming
          : [...categoriasManutencao, ...incoming]
      const unique = [
        ...new Map(
          next
            .map((nome) => nome.trim())
            .filter(Boolean)
            .map((nome) => [nome.toLocaleLowerCase(), nome]),
        ).values(),
      ].sort((a, b) => a.localeCompare(b))
      await replaceCategoriasManutencao(unique)
      const stamp = mode === 'replace' && atualizadoEm ? atualizadoEm : new Date().toISOString()
      setLocalCategoriasManutencaoStamp(stamp)
      const now = new Date().toISOString()
      setLocalModificacaoStamp(now)
      setUltimaModificacaoState(now)
      await refresh()
    },
    [categoriasManutencao, refresh],
  )

  const value = useMemo(
    () => ({
      registros,
      manutencoes,
      contasFixas,
      categoriasManutencao,
      loading,
      ultimaModificacao,
      saveRegistro,
      removeRegistro,
      importRegistros,
      saveManutencao,
      removeManutencao,
      importManutencoes,
      saveContaFixa,
      removeContaFixa,
      importContasFixas,
      saveCategoriaManutencao,
      removeCategoriaManutencao,
      importCategoriasManutencao,
      refresh,
    }),
    [
      registros,
      manutencoes,
      contasFixas,
      categoriasManutencao,
      loading,
      ultimaModificacao,
      saveRegistro,
      removeRegistro,
      importRegistros,
      saveManutencao,
      removeManutencao,
      importManutencoes,
      saveContaFixa,
      removeContaFixa,
      importContasFixas,
      saveCategoriaManutencao,
      removeCategoriaManutencao,
      importCategoriasManutencao,
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
