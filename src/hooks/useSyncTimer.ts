import { useEffect, useRef } from 'react'
import { useDrive } from '../drive/DriveContext'

const SYNC_INTERVAL_MS = 5 * 60 * 1000

export function useSyncTimer() {
  const { syncNow, isInitialSyncing } = useDrive()
  const syncRef = useRef(syncNow)
  const syncingRef = useRef(false)

  useEffect(() => {
    syncRef.current = syncNow
  }, [syncNow])

  useEffect(() => {
    if (isInitialSyncing) return

    const timer = window.setInterval(() => {
      if (syncingRef.current) return
      syncingRef.current = true
      void syncRef.current().finally(() => {
        syncingRef.current = false
      })
    }, SYNC_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [isInitialSyncing])
}
