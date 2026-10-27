export const DADOS_FILE_NAME = 'MotoristaConta-dados.json'
export const ACESSOS_FILE_NAME = 'MotoristaConta-acessos.json'

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface DriveFileRef {
  id: string
  name: string
  modifiedTime?: string
}

export interface GoogleUserInfo {
  sub: string
  name?: string
  email?: string
}

export interface AccessLogEntry {
  at: string
  email: string
  googleId: string
  userAgent: string
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('Não foi possível ler o perfil Google.')
  }
  const data = (await res.json()) as GoogleUserInfo
  if (!data.sub || !data.email) {
    throw new Error('O Google não retornou id e e-mail.')
  }
  return data
}

async function driveJson<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive (${res.status}): ${text.slice(0, 180)}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function findFileByName(
  accessToken: string,
  name: string,
): Promise<DriveFileRef | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false`)
  const data = await driveJson<{ files?: DriveFileRef[] }>(
    accessToken,
    `${DRIVE_FILES}?q=${q}&fields=files(id,name,modifiedTime)&pageSize=5&spaces=drive`,
  )
  return data.files?.[0] ?? null
}

export async function downloadFileText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Não foi possível baixar o arquivo do Drive (${res.status}).`)
  }
  return res.text()
}

function multipartBody(name: string, content: string): { body: string; contentType: string } {
  const boundary = `motoristaconta_${crypto.randomUUID()}`
  const meta = JSON.stringify({
    name,
    mimeType: 'application/json',
  })
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return { body, contentType: `multipart/related; boundary=${boundary}` }
}

export async function createJsonFile(
  accessToken: string,
  name: string,
  content: string,
): Promise<DriveFileRef> {
  const { body, contentType } = multipartBody(name, content)
  return driveJson<DriveFileRef>(accessToken, `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
}

export async function updateJsonFile(
  accessToken: string,
  fileId: string,
  name: string,
  content: string,
): Promise<DriveFileRef> {
  const { body, contentType } = multipartBody(name, content)
  return driveJson<DriveFileRef>(
    accessToken,
    `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': contentType },
      body,
    },
  )
}

export async function upsertJsonFile(
  accessToken: string,
  name: string,
  content: string,
  knownId?: string | null,
): Promise<DriveFileRef> {
  if (knownId) {
    try {
      return await updateJsonFile(accessToken, knownId, name, content)
    } catch {
      // id antigo inválido — cria de novo
    }
  }
  const existing = await findFileByName(accessToken, name)
  if (existing) {
    return updateJsonFile(accessToken, existing.id, name, content)
  }
  return createJsonFile(accessToken, name, content)
}

export function appendAccessLog(existingRaw: string | null, entry: AccessLogEntry, max = 200): string {
  let list: AccessLogEntry[] = []
  if (existingRaw) {
    try {
      const parsed: unknown = JSON.parse(existingRaw)
      if (Array.isArray(parsed)) {
        list = parsed.filter(isAccessLogEntry)
      }
    } catch {
      list = []
    }
  }
  list.push(entry)
  if (list.length > max) list = list.slice(-max)
  return JSON.stringify(list, null, 2)
}

function isAccessLogEntry(item: unknown): item is AccessLogEntry {
  if (!item || typeof item !== 'object') return false
  const row = item as Partial<AccessLogEntry>
  return Boolean(row.at && row.email && row.googleId)
}
