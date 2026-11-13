import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { parseBackupJson, serializeBackup } from '../lib/backup'
import { useTheme } from '../theme/ThemeContext'
import {
  ACESSOS_FILE_NAME,
  DADOS_FILE_NAME,
  appendAccessLog,
  downloadFileText,
  findFileByName,
  upsertJsonFile,
} from './api'
import { compararESincronizar } from './conflict'
import { loadDriveFileIds, saveDriveFileIds } from './fileIds'
import {
  getLocalModificacaoStamp,
  getLocalSincronizacaoStamp,
  getLocalCategoriasManutencaoStamp,
  setLocalModificacaoStamp,
  setLocalSincronizacaoStamp,
} from './syncStorage'

export type DriveStatus = 'idle' | 'connecting' | 'syncing' | 'ok' | 'offline' | 'error' | 'dev'

interface DriveContextValue {
  status: DriveStatus
  message: string | null
  lastSyncAt: string | null
  isInitialSyncing: boolean
  syncNow: () => Promise<void>
  reconnect: () => Promise<void>
}

const DriveContext = createContext<DriveContextValue | null>(null)

const DEBOUNCE_MS = 2000

export function DriveProvider({ children }: { children: ReactNode }) {
  const { session, ensureDriveToken } = useAuth()
  const {
    registros,
    manutencoes,
    contasFixas,
    categoriasManutencao,
    loading,
    importRegistros,
    importManutencoes,
    importContasFixas,
    importCategoriasManutencao,
  } = useData()
  const { settings, updateSettings } = useTheme()
  const [status, setStatus] = useState<DriveStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(getLocalSincronizacaoStamp() || null)
  const [isInitialSyncing, setIsInitialSyncing] = useState(
    Boolean(session && session.googleId !== 'dev-bypass'),
  )

  const readyRef = useRef(false)
  const skipNextRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const logWrittenRef = useRef(false)

  const isDevBypass = session?.googleId === 'dev-bypass'

  const persistIds = useCallback(
    (patch: { dadosId?: string; acessosId?: string }) => {
      if (!session) return
      const prev = loadDriveFileIds(session.googleId)
      saveDriveFileIds(session.googleId, { ...prev, ...patch })
    },
    [session],
  )

  const uploadPayload = useCallback(
    async (
      accessToken: string,
      nextRegistros = registros,
      nextManutencoes = manutencoes,
      nextSettings = settings,
      nextModificacao = getLocalModificacaoStamp(),
      nextSincronizacao = new Date().toISOString(),
      nextContasFixas = contasFixas,
      nextCategoriasManutencao = categoriasManutencao,
      nextCategoriasStamp = getLocalCategoriasManutencaoStamp(),
    ) => {
      if (!session) return
      const payload = serializeBackup(
        nextRegistros,
        nextSettings,
        nextManutencoes,
        undefined,
        nextModificacao,
        nextSincronizacao,
        nextContasFixas,
        nextCategoriasManutencao,
        nextCategoriasStamp,
      )
      const ids = loadDriveFileIds(session.googleId)
      const file = await upsertJsonFile(
        accessToken,
        DADOS_FILE_NAME,
        JSON.stringify(payload, null, 2),
        ids.dadosId,
      )
      persistIds({ dadosId: file.id })
      setLocalSincronizacaoStamp(nextSincronizacao)
      setLastSyncAt(nextSincronizacao)
      setStatus('ok')
    },
    [categoriasManutencao, contasFixas, manutencoes, persistIds, registros, session, settings],
  )

  const writeAccessLog = useCallback(
    async (accessToken: string) => {
      if (!session || logWrittenRef.current) return
      const ids = loadDriveFileIds(session.googleId)
      let existing: string | null = null
      let fileId = ids.acessosId
      if (!fileId) {
        const found = await findFileByName(accessToken, ACESSOS_FILE_NAME)
        fileId = found?.id
      }
      if (fileId) {
        try {
          existing = await downloadFileText(accessToken, fileId)
        } catch {
          existing = null
          fileId = undefined
        }
      }
      const next = appendAccessLog(existing, {
        at: new Date().toISOString(),
        email: session.email,
        googleId: session.googleId,
        userAgent: navigator.userAgent,
      })
      const file = await upsertJsonFile(accessToken, ACESSOS_FILE_NAME, next, fileId)
      persistIds({ acessosId: file.id })
      logWrittenRef.current = true
    },
    [persistIds, session],
  )

  const runInitialSync = useCallback(async () => {
    if (!session || isDevBypass) {
      setStatus(isDevBypass ? 'dev' : 'idle')
      setMessage(
        isDevBypass
          ? 'Modo de teste: o Google Drive não sincroniza sem login Google real.'
          : null,
      )
      readyRef.current = true
      setIsInitialSyncing(false)
      return
    }

    setStatus('connecting')
    setMessage('Conectando ao Google Drive…')
    setIsInitialSyncing(true)

    try {
      const accessToken = await ensureDriveToken('')
      const ids = loadDriveFileIds(session.googleId)
      let remoteRaw: string | null = null
      let dadosId = ids.dadosId
      if (!dadosId) {
        const found = await findFileByName(accessToken, DADOS_FILE_NAME)
        dadosId = found?.id
        if (dadosId) persistIds({ dadosId })
      }
      if (dadosId) {
        try {
          remoteRaw = await downloadFileText(accessToken, dadosId)
        } catch {
          dadosId = undefined
        }
      }

      const remote = remoteRaw ? parseBackupJson(remoteRaw) : null
      const now = new Date().toISOString()
      const localMod = getLocalModificacaoStamp()
      const localSync = getLocalSincronizacaoStamp()
      const localPayload = serializeBackup(
        registros,
        settings,
        manutencoes,
        now,
        localMod,
        localSync,
        contasFixas,
        categoriasManutencao,
        getLocalCategoriasManutencaoStamp(),
      )

      // Compara e resolve a precedência e mesclagem registro a registro
      const syncResult = compararESincronizar(localPayload, remote, now)

      let nextRegistros = registros
      let nextManutencoes = manutencoes
      let nextContasFixas = contasFixas
      let nextCategoriasManutencao = categoriasManutencao
      let nextCategoriasStamp = getLocalCategoriasManutencaoStamp()
      let nextSettings = settings

      if (syncResult.needsLocalUpdate) {
        skipNextRef.current = true
        nextRegistros = syncResult.mergedRegistros
        nextManutencoes = syncResult.mergedManutencoes
        nextContasFixas = syncResult.mergedContasFixas
        nextCategoriasManutencao = syncResult.mergedPayload.categoriasManutencao ?? []
        nextCategoriasStamp =
          syncResult.mergedPayload.categoriasManutencaoAtualizadoEm ?? nextCategoriasStamp
        nextSettings = syncResult.mergedPayload.settings
        await importRegistros(nextRegistros, 'replace')
        await importManutencoes(nextManutencoes, 'replace')
        await importContasFixas(nextContasFixas, 'replace')
        await importCategoriasManutencao(
          nextCategoriasManutencao,
          'replace',
          nextCategoriasStamp,
        )
        if (syncResult.mergedPayload.settings) {
          updateSettings(syncResult.mergedPayload.settings)
        }
        setLocalModificacaoStamp(
          syncResult.mergedPayload.ultimaModificacao || syncResult.mergedPayload.ultimaSincronizacao,
        )
      }

      if (syncResult.needsRemoteUpload) {
        await uploadPayload(
          accessToken,
          nextRegistros,
          nextManutencoes,
          nextSettings,
          syncResult.mergedPayload.ultimaModificacao,
          syncResult.mergedPayload.ultimaSincronizacao,
          nextContasFixas,
          nextCategoriasManutencao,
          nextCategoriasStamp,
        )
      }

      setLocalSincronizacaoStamp(syncResult.mergedPayload.ultimaSincronizacao || now)
      setLastSyncAt(syncResult.mergedPayload.ultimaSincronizacao || now)
      setStatus('ok')
      setMessage(syncResult.message)
      await writeAccessLog(accessToken)
      readyRef.current = true
      setIsInitialSyncing(false)
    } catch (err) {
      readyRef.current = true
      setIsInitialSyncing(false)
      setStatus('error')
      setMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível sincronizar com o Google Drive. Toque em Reconectar.',
      )
    }
  }, [
    ensureDriveToken,
    importManutencoes,
    importContasFixas,
    importCategoriasManutencao,
    importRegistros,
    isDevBypass,
    manutencoes,
    contasFixas,
    categoriasManutencao,
    persistIds,
    registros,
    session,
    settings,
    updateSettings,
    uploadPayload,
    writeAccessLog,
  ])

  const initialKey = session?.googleId ?? ''
  useEffect(() => {
    if (loading) return
    readyRef.current = false
    logWrittenRef.current = false
    void runInitialSync()
    // Só no login / quando o IndexedDB terminar de carregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, loading])

  // Debounce para envio automático quando o usuário altera dados localmente
  useEffect(() => {
    if (!readyRef.current || isDevBypass || loading) return
    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          setStatus('syncing')
          const accessToken = await ensureDriveToken('')
          const now = new Date().toISOString()
          await uploadPayload(
            accessToken,
            registros,
            manutencoes,
            settings,
            getLocalModificacaoStamp() || now,
            now,
            contasFixas,
            categoriasManutencao,
            getLocalCategoriasManutencaoStamp(),
          )
          setMessage('Sincronizado — dados locais estão mais atualizados, enviados ao Google Drive')
        } catch (err) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : 'Falha ao enviar backup.')
        }
      })()
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [
    ensureDriveToken,
    isDevBypass,
    loading,
    manutencoes,
    contasFixas,
    categoriasManutencao,
    registros,
    settings,
    uploadPayload,
  ])

  const syncNow = useCallback(async () => {
    if (isDevBypass || !session) return
    setStatus('syncing')
    setMessage('Sincronizando com o Google Drive…')
    try {
      const accessToken = await ensureDriveToken('')
      const ids = loadDriveFileIds(session.googleId)
      let remoteRaw: string | null = null
      let dadosId = ids.dadosId
      if (!dadosId) {
        const found = await findFileByName(accessToken, DADOS_FILE_NAME)
        dadosId = found?.id
        if (dadosId) persistIds({ dadosId })
      }
      if (dadosId) {
        try {
          remoteRaw = await downloadFileText(accessToken, dadosId)
        } catch {
          dadosId = undefined
        }
      }

      const remote = remoteRaw ? parseBackupJson(remoteRaw) : null
      const now = new Date().toISOString()
      const localMod = getLocalModificacaoStamp()
      const localSync = getLocalSincronizacaoStamp()
      const localPayload = serializeBackup(
        registros,
        settings,
        manutencoes,
        now,
        localMod,
        localSync,
        contasFixas,
        categoriasManutencao,
        getLocalCategoriasManutencaoStamp(),
      )

      const syncResult = compararESincronizar(localPayload, remote, now)

      let nextRegistros = registros
      let nextManutencoes = manutencoes
      let nextContasFixas = contasFixas
      let nextCategoriasManutencao = categoriasManutencao
      let nextCategoriasStamp = getLocalCategoriasManutencaoStamp()
      let nextSettings = settings

      if (syncResult.needsLocalUpdate) {
        skipNextRef.current = true
        nextRegistros = syncResult.mergedRegistros
        nextManutencoes = syncResult.mergedManutencoes
        nextContasFixas = syncResult.mergedContasFixas
        nextCategoriasManutencao = syncResult.mergedPayload.categoriasManutencao ?? []
        nextCategoriasStamp =
          syncResult.mergedPayload.categoriasManutencaoAtualizadoEm ?? nextCategoriasStamp
        nextSettings = syncResult.mergedPayload.settings
        await importRegistros(nextRegistros, 'replace')
        await importManutencoes(nextManutencoes, 'replace')
        await importContasFixas(nextContasFixas, 'replace')
        await importCategoriasManutencao(
          nextCategoriasManutencao,
          'replace',
          nextCategoriasStamp,
        )
        if (syncResult.mergedPayload.settings) {
          updateSettings(syncResult.mergedPayload.settings)
        }
        setLocalModificacaoStamp(
          syncResult.mergedPayload.ultimaModificacao || syncResult.mergedPayload.ultimaSincronizacao,
        )
      }

      if (syncResult.needsRemoteUpload) {
        await uploadPayload(
          accessToken,
          nextRegistros,
          nextManutencoes,
          nextSettings,
          syncResult.mergedPayload.ultimaModificacao,
          syncResult.mergedPayload.ultimaSincronizacao,
          nextContasFixas,
          nextCategoriasManutencao,
          nextCategoriasStamp,
        )
      }

      setLocalSincronizacaoStamp(syncResult.mergedPayload.ultimaSincronizacao || now)
      setLastSyncAt(syncResult.mergedPayload.ultimaSincronizacao || now)
      setStatus('ok')
      setMessage(syncResult.message)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Falha ao sincronizar.')
    }
  }, [
    ensureDriveToken,
    importManutencoes,
    importContasFixas,
    importCategoriasManutencao,
    importRegistros,
    isDevBypass,
    manutencoes,
    contasFixas,
    categoriasManutencao,
    persistIds,
    registros,
    session,
    settings,
    updateSettings,
    uploadPayload,
  ])

  const reconnect = useCallback(async () => {
    if (isDevBypass) return
    setStatus('connecting')
    await ensureDriveToken('consent')
    await runInitialSync()
  }, [ensureDriveToken, isDevBypass, runInitialSync])

  const value = useMemo(
    () => ({
      status,
      message,
      lastSyncAt,
      isInitialSyncing,
      syncNow,
      reconnect,
    }),
    [status, message, lastSyncAt, isInitialSyncing, syncNow, reconnect],
  )

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>
}

export function useDrive(): DriveContextValue {
  const ctx = useContext(DriveContext)
  if (!ctx) {
    throw new Error('useDrive precisa estar dentro de DriveProvider')
  }
  return ctx
}
