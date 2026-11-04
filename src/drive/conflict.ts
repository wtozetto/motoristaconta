import {
  BACKUP_VERSION,
  type BackupPayload,
  type Manutencao,
  type Registro,
} from '../types'
import { getLatestRecordStamp } from '../lib/backup'

export type SyncAction =
  | 'remote-applied'
  | 'local-applied'
  | 'merged'
  | 'up-to-date'
  | 'noop'

export interface SyncComparisonResult {
  action: SyncAction
  message: string
  mergedPayload: BackupPayload
  needsLocalUpdate: boolean
  needsRemoteUpload: boolean
  mergedRegistros: Registro[]
  mergedManutencoes: Manutencao[]
}

export function getModificacaoStamp(payload: BackupPayload | null): string {
  if (!payload) return ''
  return (
    payload.ultimaModificacao ||
    payload.ultimaSincronizacao ||
    getLatestRecordStamp(payload) ||
    payload.exportedAt ||
    ''
  )
}

/**
 * Compara a versão local (IndexedDB) com a versão remota (Google Drive)
 * e mescla entradas individuais por `id` e `atualizadoEm` para garantir que
 * nenhuma alteração seja perdida.
 */
export function compararESincronizar(
  local: BackupPayload,
  remoto: BackupPayload | null,
  now = new Date().toISOString(),
): SyncComparisonResult {
  const localCount = local.registros.length + (local.manutencoes?.length ?? 0)
  const remoteCount =
    (remoto?.registros.length ?? 0) + (remoto?.manutencoes?.length ?? 0)

  // Caso 1: Ambos vazios
  if (localCount === 0 && (!remoto || remoteCount === 0)) {
    return {
      action: 'noop',
      message: 'Sistema já está atualizado',
      mergedPayload: {
        ...local,
        ultimaSincronizacao: now,
      },
      needsLocalUpdate: false,
      needsRemoteUpload: false,
      mergedRegistros: local.registros,
      mergedManutencoes: local.manutencoes ?? [],
    }
  }

  // Caso 2: Remoto não existe ou está vazio, mas local tem dados
  if (!remoto || remoteCount === 0) {
    const mergedPayload: BackupPayload = {
      ...local,
      version: BACKUP_VERSION,
      versaoSchema: BACKUP_VERSION,
      ultimaModificacao: getModificacaoStamp(local) || now,
      ultimaSincronizacao: now,
    }
    return {
      action: 'local-applied',
      message: 'Sincronizado — dados locais estão mais atualizados, enviados ao Google Drive',
      mergedPayload,
      needsLocalUpdate: false,
      needsRemoteUpload: true,
      mergedRegistros: local.registros,
      mergedManutencoes: local.manutencoes ?? [],
    }
  }

  // Caso 3: Local está vazio, mas remoto tem dados
  if (localCount === 0 && remoteCount > 0) {
    const mergedPayload: BackupPayload = {
      ...remoto,
      version: BACKUP_VERSION,
      versaoSchema: BACKUP_VERSION,
      ultimaSincronizacao: now,
    }
    return {
      action: 'remote-applied',
      message: 'Sincronizado — versão mais recente do Google Drive aplicada',
      mergedPayload,
      needsLocalUpdate: true,
      needsRemoteUpload: false,
      mergedRegistros: remoto.registros,
      mergedManutencoes: remoto.manutencoes ?? [],
    }
  }

  // Caso 4: Ambos têm dados — mesclagem inteligente registro a registro
  let localHasNewer = false
  let remoteHasNewer = false

  // Mesclagem de Lançamentos (registros)
  const localRegMap = new Map(local.registros.map((r) => [r.id, r]))
  const remoteRegMap = new Map(remoto.registros.map((r) => [r.id, r]))
  const allRegIds = new Set([...localRegMap.keys(), ...remoteRegMap.keys()])
  const mergedRegistros: Registro[] = []

  for (const id of allRegIds) {
    const loc = localRegMap.get(id)
    const rem = remoteRegMap.get(id)

    if (loc && !rem) {
      mergedRegistros.push(loc)
      localHasNewer = true
    } else if (rem && !loc) {
      mergedRegistros.push(rem)
      remoteHasNewer = true
    } else if (loc && rem) {
      if (loc.atualizadoEm > rem.atualizadoEm) {
        mergedRegistros.push(loc)
        localHasNewer = true
      } else if (rem.atualizadoEm > loc.atualizadoEm) {
        mergedRegistros.push(rem)
        remoteHasNewer = true
      } else {
        // Se ambos têm o mesmo atualizadoEm, preserva o local
        mergedRegistros.push(loc)
      }
    }
  }
  mergedRegistros.sort((a, b) => b.data.localeCompare(a.data))

  // Mesclagem de Manutenções
  const localManMap = new Map((local.manutencoes ?? []).map((m) => [m.id, m]))
  const remoteManMap = new Map((remoto.manutencoes ?? []).map((m) => [m.id, m]))
  const allManIds = new Set([...localManMap.keys(), ...remoteManMap.keys()])
  const mergedManutencoes: Manutencao[] = []

  for (const id of allManIds) {
    const loc = localManMap.get(id)
    const rem = remoteManMap.get(id)

    if (loc && !rem) {
      mergedManutencoes.push(loc)
      localHasNewer = true
    } else if (rem && !loc) {
      mergedManutencoes.push(rem)
      remoteHasNewer = true
    } else if (loc && rem) {
      if (loc.atualizadoEm > rem.atualizadoEm) {
        mergedManutencoes.push(loc)
        localHasNewer = true
      } else if (rem.atualizadoEm > loc.atualizadoEm) {
        mergedManutencoes.push(rem)
        remoteHasNewer = true
      } else {
        mergedManutencoes.push(loc)
      }
    }
  }
  mergedManutencoes.sort((a, b) => b.data.localeCompare(a.data))

  // Mesclagem de Configurações
  const localMod = getModificacaoStamp(local)
  const remoteMod = getModificacaoStamp(remoto)
  let mergedSettings = local.settings
  if (JSON.stringify(local.settings) !== JSON.stringify(remoto.settings)) {
    if (remoteMod > localMod) {
      mergedSettings = remoto.settings
      remoteHasNewer = true
    } else {
      mergedSettings = local.settings
      localHasNewer = true
    }
  }

  // Verificação de timestamps gerais caso não tenha havido inclusão/alteração de registros
  if (!localHasNewer && !remoteHasNewer) {
    if (localMod > remoteMod && localMod > (remoto.ultimaSincronizacao ?? '')) {
      localHasNewer = true
    } else if (remoteMod > localMod && remoteMod > (local.ultimaSincronizacao ?? '')) {
      remoteHasNewer = true
    }
  }

  const latestMod = [localMod, remoteMod, now].reduce(
    (best, item) => (item > best ? item : best),
    '',
  )

  // Avaliação do resultado final
  if (localHasNewer && remoteHasNewer) {
    // Houve alterações em ambos os lados
    const mergedPayload: BackupPayload = {
      version: BACKUP_VERSION,
      versaoSchema: BACKUP_VERSION,
      app: 'MotoristaConta',
      exportedAt: now,
      ultimaModificacao: now,
      ultimaSincronizacao: now,
      settings: mergedSettings,
      registros: mergedRegistros,
      manutencoes: mergedManutencoes,
    }
    return {
      action: 'merged',
      message: 'Mesclagem realizada — existiam alterações nos dois lados',
      mergedPayload,
      needsLocalUpdate: true,
      needsRemoteUpload: true,
      mergedRegistros,
      mergedManutencoes,
    }
  }

  if (remoteHasNewer && !localHasNewer) {
    // Apenas o Google Drive tinha versão mais recente
    const mergedPayload: BackupPayload = {
      ...remoto,
      version: BACKUP_VERSION,
      versaoSchema: BACKUP_VERSION,
      ultimaModificacao: remoteMod,
      ultimaSincronizacao: now,
      settings: mergedSettings,
      registros: mergedRegistros,
      manutencoes: mergedManutencoes,
    }
    return {
      action: 'remote-applied',
      message: 'Sincronizado — versão mais recente do Google Drive aplicada',
      mergedPayload,
      needsLocalUpdate: true,
      needsRemoteUpload: false,
      mergedRegistros,
      mergedManutencoes,
    }
  }

  if (localHasNewer && !remoteHasNewer) {
    // Apenas os dados locais foram alterados
    const mergedPayload: BackupPayload = {
      ...local,
      version: BACKUP_VERSION,
      versaoSchema: BACKUP_VERSION,
      ultimaModificacao: localMod || now,
      ultimaSincronizacao: now,
      settings: mergedSettings,
      registros: mergedRegistros,
      manutencoes: mergedManutencoes,
    }
    return {
      action: 'local-applied',
      message: 'Sincronizado — dados locais estão mais atualizados, enviados ao Google Drive',
      mergedPayload,
      needsLocalUpdate: false,
      needsRemoteUpload: true,
      mergedRegistros,
      mergedManutencoes,
    }
  }

  // Nenhuma alteração pendente
  const mergedPayload: BackupPayload = {
    ...local,
    version: BACKUP_VERSION,
    versaoSchema: BACKUP_VERSION,
    ultimaModificacao: latestMod,
    ultimaSincronizacao: now,
    registros: mergedRegistros,
    manutencoes: mergedManutencoes,
  }
  return {
    action: 'up-to-date',
    message: 'Sistema já está atualizado',
    mergedPayload,
    needsLocalUpdate: false,
    needsRemoteUpload: false,
    mergedRegistros,
    mergedManutencoes,
  }
}
