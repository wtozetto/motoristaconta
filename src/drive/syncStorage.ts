export const ULTIMA_MODIFICACAO_KEY = 'motoristaconta.ultimaModificacao'
export const ULTIMA_SINCRONIZACAO_KEY = 'motoristaconta.ultimaSincronizacao'
export const CATEGORIAS_MANUTENCAO_STAMP_KEY = 'motoristaconta.categoriasManutencaoAtualizadoEm'
let activeScope = ''

function scopedKey(key: string): string {
  return activeScope ? `${key}.${encodeURIComponent(activeScope)}` : key
}

export function setSyncStorageScope(scope: string): void {
  const nextScope = scope.trim()
  if (nextScope === activeScope) return
  activeScope = nextScope
  if (!nextScope) return
  try {
    if (localStorage.getItem('motoristaconta.legacyDataOwner') !== nextScope) return
    for (const key of [ULTIMA_MODIFICACAO_KEY, ULTIMA_SINCRONIZACAO_KEY, CATEGORIAS_MANUTENCAO_STAMP_KEY]) {
      const scoped = scopedKey(key)
      if (!localStorage.getItem(scoped)) {
        const legacy = localStorage.getItem(key)
        if (legacy) localStorage.setItem(scoped, legacy)
      }
    }
  } catch (error) {
    console.error('Falha ao carregar os carimbos locais do usuário:', error)
  }
}

export function getLocalCategoriasManutencaoStamp(): string {
  try {
    return localStorage.getItem(scopedKey(CATEGORIAS_MANUTENCAO_STAMP_KEY)) ?? ''
  } catch {
    return ''
  }
}

export function setLocalCategoriasManutencaoStamp(stamp = new Date().toISOString()): void {
  try {
    localStorage.setItem(scopedKey(CATEGORIAS_MANUTENCAO_STAMP_KEY), stamp)
  } catch {
    // ignorar falha de localStorage em ambientes restritos
  }
}

export function getLocalModificacaoStamp(): string {
  try {
    return localStorage.getItem(scopedKey(ULTIMA_MODIFICACAO_KEY)) ?? ''
  } catch {
    return ''
  }
}

export function setLocalModificacaoStamp(stamp = new Date().toISOString()): void {
  try {
    localStorage.setItem(scopedKey(ULTIMA_MODIFICACAO_KEY), stamp)
  } catch {
    // ignorar falha de localStorage em ambientes restritos
  }
}

export function getLocalSincronizacaoStamp(): string {
  try {
    return localStorage.getItem(scopedKey(ULTIMA_SINCRONIZACAO_KEY)) ?? ''
  } catch {
    return ''
  }
}

export function setLocalSincronizacaoStamp(stamp = new Date().toISOString()): void {
  try {
    localStorage.setItem(scopedKey(ULTIMA_SINCRONIZACAO_KEY), stamp)
  } catch {
    // ignorar falha de localStorage em ambientes restritos
  }
}

