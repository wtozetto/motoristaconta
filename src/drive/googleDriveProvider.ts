import { downloadFileText, findFileByName, upsertJsonFile } from './api'
import type { CloudStorageProvider } from './storageProvider'

export const googleDriveProvider: CloudStorageProvider = {
  id: 'google-drive',
  displayName: 'Google Drive',
  findFile: findFileByName,
  readFile: downloadFileText,
  writeFile: upsertJsonFile,
}
