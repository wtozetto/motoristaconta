import type { DriveFileRef } from './api'

export interface CloudStorageProvider {
  readonly id: string
  readonly displayName: string
  findFile(accessToken: string, name: string): Promise<DriveFileRef | null>
  readFile(accessToken: string, fileId: string): Promise<string>
  writeFile(
    accessToken: string,
    name: string,
    content: string,
    fileId?: string,
  ): Promise<DriveFileRef>
}
