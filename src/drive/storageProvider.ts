export interface CloudFileReference {
  id: string
}

export interface CloudStorageProvider {
  readonly id: string
  readonly displayName: string
  findFile(accessToken: string, name: string): Promise<CloudFileReference | null>
  readFile(accessToken: string, fileId: string): Promise<string>
  writeFile(
    accessToken: string,
    name: string,
    content: string,
    fileId?: string,
  ): Promise<CloudFileReference>
}
