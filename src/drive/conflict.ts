import type { BackupPayload } from '../types'

export type SyncDecision = 'restore' | 'keep-local' | 'noop'

export function backupStamp(payload: BackupPayload | null): string {
  if (!payload) return ''
  const stamps = [payload.exportedAt, ...payload.registros.map((r) => r.atualizadoEm)]
  return stamps.reduce((best, item) => (item > best ? item : best), '')
}

export function decideSync(
  localCount: number,
  localStamp: string,
  remote: BackupPayload | null,
): SyncDecision {
  const remoteCount = remote?.registros.length ?? 0
  if (remoteCount === 0 && localCount === 0) return 'noop'
  if (remoteCount === 0) return 'keep-local'
  if (localCount === 0) return 'restore'
  const remoteStamp = backupStamp(remote)
  if (remoteStamp > localStamp) return 'restore'
  return 'keep-local'
}
