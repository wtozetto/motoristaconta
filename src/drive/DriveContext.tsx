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
import { applyImport, parseBackupJson, serializeBackup } from '../lib/backup'
import { useTheme } from '../theme/ThemeContext'
import {
  ACESSOS_FILE_NAME,
  DADOS_FILE_NAME,
  appendAccessLog,
  downloadFileText,
  findFileByName,
  upsertJsonFile,
} from './api'
import { backupStamp, decideSync } from './conflict'
import { loadDriveFileIds, saveDriveFileIds } from './fileIds'

export type DriveStatus = 'idle' | 'connecting' | 'syncing' | 'ok' | 'offline' | 'error' | 'dev'

interface DriveContextValue {
  status: DriveStatus
  message: string | null
  lastSyncAt: string | null
  syncNow: () => Promise<void>
  reconnect: () => Promise<void>
}

const DriveContext = createContext<DriveContextValue | null>(null)

const DEBOUNCE_MS = 2000

export function DriveProvider({ children }: { children: ReactNode }) {
  const { session, ensureDriveToken } = useAuth()
  const { registros, loading, importRegistros } = useData()
  const { settings, updateSettings } = useTheme()
  const [status, setStatus] = useState<DriveStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
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
      nextSettings = settings,
    ) => {
      if (!session) return
      const payload = serializeBackup(nextRegistros, nextSettings)
      const ids = loadDriveFileIds(session.googleId)
      const file = await upsertJsonFile(
        accessToken,
        DADOS_FILE_NAME,
        JSON.stringify(payload, null, 2),
        ids.dadosId,
      )
      persistIds({ dadosId: file.id })
      setLastSyncAt(new Date().toISOString())
      setStatus('ok')
      setMessage('Backup no Google Drive atualizado.')
    },
    [persistIds, registros, session, settings],
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
      return
    }
    setStatus('connecting')
    setMessage('Conectando ao Google Drive…')
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
      const localStamp = backupStamp(serializeBackup(registros, settings))
      const decision = decideSync(registros.length, localStamp, remote)

      let nextRegistros = registros
      let nextSettings = settings
      if (decision === 'restore' && remote) {
        skipNextRef.current = true
        nextRegistros = applyImport(registros, remote.registros, 'merge')
        nextSettings = { ...settings, ...remote.settings }
        await importRegistros(nextRegistros, 'replace')
        if (remote.settings) updateSettings(remote.settings)
        setMessage('Dados restaurados do Google Drive (registros mais recentes prevalecem).')
      }

      setStatus('syncing')
      await uploadPayload(accessToken, nextRegistros, nextSettings)
      await writeAccessLog(accessToken)
      readyRef.current = true
    } catch (err) {
      readyRef.current = true
      setStatus('error')
      setMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível sincronizar com o Google Drive. Toque em Reconectar.',
      )
    }
  }, [
    ensureDriveToken,
    importRegistros,
    isDevBypass,
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
          await uploadPayload(accessToken)
        } catch (err) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : 'Falha ao enviar backup.')
        }
      })()
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [ensureDriveToken, isDevBypass, loading, registros, settings, uploadPayload])

  const syncNow = useCallback(async () => {
    if (isDevBypass) return
    setStatus('syncing')
    const accessToken = await ensureDriveToken('')
    await uploadPayload(accessToken)
  }, [ensureDriveToken, isDevBypass, uploadPayload])

  const reconnect = useCallback(async () => {
    if (isDevBypass) return
    setStatus('connecting')
    await ensureDriveToken('consent')
    await runInitialSync()
  }, [ensureDriveToken, isDevBypass, runInitialSync])

  const value = useMemo(
    () => ({ status, message, lastSyncAt, syncNow, reconnect }),
    [status, message, lastSyncAt, syncNow, reconnect],
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
