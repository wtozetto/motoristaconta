export const ULTIMA_MODIFICACAO_KEY = 'motoristaconta.ultimaModificacao'
export const ULTIMA_SINCRONIZACAO_KEY = 'motoristaconta.ultimaSincronizacao'

export function getLocalModificacaoStamp(): string {
  try {
    return localStorage.getItem(ULTIMA_MODIFICACAO_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setLocalModificacaoStamp(stamp = new Date().toISOString()): void {
  try {
    localStorage.setItem(ULTIMA_MODIFICACAO_KEY, stamp)
  } catch {
    // ignorar falha de localStorage em ambientes restritos
  }
}

export function getLocalSincronizacaoStamp(): string {
  try {
    return localStorage.getItem(ULTIMA_SINCRONIZACAO_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setLocalSincronizacaoStamp(stamp = new Date().toISOString()): void {
  try {
    localStorage.setItem(ULTIMA_SINCRONIZACAO_KEY, stamp)
  } catch {
    // ignorar falha de localStorage em ambientes restritos
  }
}

