export interface DriveFileIds {
  dadosId?: string
  acessosId?: string
}

function key(googleId: string): string {
  return `motoristaconta.driveFiles.${googleId}`
}

export function loadDriveFileIds(googleId: string): DriveFileIds {
  try {
    const raw = localStorage.getItem(key(googleId))
    if (!raw) return {}
    return JSON.parse(raw) as DriveFileIds
  } catch {
    return {}
  }
}

export function saveDriveFileIds(googleId: string, ids: DriveFileIds): void {
  localStorage.setItem(key(googleId), JSON.stringify(ids))
}

export function clearDriveFileIds(googleId: string): void {
  localStorage.removeItem(key(googleId))
}
