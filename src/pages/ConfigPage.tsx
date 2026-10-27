import { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { useDrive } from '../drive/DriveContext'
import { useTheme } from '../theme/ThemeContext'
import { applyImport, backupToJson, parseBackupJson } from '../lib/backup'
import { downloadJsonBackup, downloadTextFile, registrosToCsv } from '../lib/csv'
import { todayISO } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ImportMode } from '../lib/backup'
import type { ThemePreference } from '../types'

export function ConfigPage() {
  const { session, logout } = useAuth()
  const { settings, setTheme, updateSettings } = useTheme()
  const { registros, importRegistros } = useData()
  const { status, message: driveMessage, lastSyncAt, syncNow, reconnect } = useDrive()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMode, setImportMode] = useState<ImportMode | null>(null)
  const [pendingPayload, setPendingPayload] = useState<ReturnType<typeof parseBackupJson> | null>(
    null,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function exportJson() {
    const json = backupToJson(registros, settings)
    downloadJsonBackup(`motoristaconta-${todayISO()}.json`, json)
  }

  function exportCsv() {
    downloadTextFile(
      `motoristaconta-${todayISO()}.csv`,
      registrosToCsv(registros),
      'text/csv;charset=utf-8',
    )
  }

  async function onFile(file: File) {
    try {
      const text = await file.text()
      const payload = parseBackupJson(text)
      setPendingPayload(payload)
      setImportMode('merge')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON inválido.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-slate-500">Preferências locais, backup e conta.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Metas</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Meta R$/km
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
              value={settings.metaRsPorKm}
              onChange={(e) => updateSettings({ metaRsPorKm: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Reserva (%)
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
              value={settings.reservaPercent}
              onChange={(e) => updateSettings({ reservaPercent: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Padrão de reserva: 15% dos ganhos. A dica do dashboard compara esse valor acumulado com o
          lucro líquido do período.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Aparência</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Tema">
          {(
            [
              ['light', 'Claro'],
              ['dark', 'Escuro'],
              ['system', 'Sistema'],
            ] as [ThemePreference, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ${
                settings.theme === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="theme"
                checked={settings.theme === value}
                onChange={() => setTheme(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Backup e exportação</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
          >
            Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
        </div>
        {message ? <p className="mt-2 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Google Drive (automático)</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Após cada lançamento, o app grava <strong>MotoristaConta-dados.json</strong> no Drive da
          conta logada. No login, restaura se o arquivo do Drive for mais recente. Também anexa um
          registro em <strong>MotoristaConta-acessos.json</strong>.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Status:{' '}
          {status === 'ok'
            ? 'sincronizado'
            : status === 'syncing' || status === 'connecting'
              ? 'sincronizando…'
              : status === 'error'
                ? 'falhou'
                : status === 'dev'
                  ? 'modo de teste (sem Drive)'
                  : 'aguardando'}
          {lastSyncAt
            ? ` · ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSyncAt))}`
            : ''}
        </p>
        {driveMessage ? (
          <p className={`mt-2 text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {driveMessage}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void syncNow().then(
                () => setMessage('Backup enviado ao Drive.'),
                (err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Falha ao sincronizar.'),
              )
            }}
            className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
          >
            Sincronizar agora
          </button>
          <button
            type="button"
            onClick={() => {
              void reconnect().catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Falha ao reconectar.'),
              )
            }}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
          >
            Reconectar Drive
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Escopo usado: drive.file — o app só vê arquivos que ele mesmo criou, não a sua pasta
          inteira. Exportar JSON/CSV continua disponível como cópia extra neste aparelho.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Conta</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Nome</dt>
            <dd>{session?.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">E-mail</dt>
            <dd className="truncate">{session?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">ID Google</dt>
            <dd className="truncate">{session?.googleId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Último acesso</dt>
            <dd>
              {session?.lastAccessAt
                ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                    new Date(session.lastAccessAt),
                  )
                : '—'}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={logout}
          className="mt-4 h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-700"
        >
          Sair
        </button>
      </section>

      <ConfirmDialog
        open={Boolean(importMode && pendingPayload)}
        title="Como importar o JSON?"
        confirmLabel={importMode === 'replace' ? 'Substituir tudo' : 'Mesclar'}
        danger={importMode === 'replace'}
        onCancel={() => {
          setImportMode(null)
          setPendingPayload(null)
        }}
        onConfirm={async () => {
          if (!pendingPayload || !importMode) return
          const next = applyImport(registros, pendingPayload.registros, importMode)
          await importRegistros(next, 'replace')
          if (pendingPayload.settings) {
            updateSettings(pendingPayload.settings)
          }
          setMessage(
            importMode === 'replace'
              ? 'Dados substituídos pelo arquivo importado.'
              : 'Dados mesclados. Registros mais recentes (atualizadoEm) prevalecem.',
          )
          setImportMode(null)
          setPendingPayload(null)
        }}
      >
        <p>
          Encontramos {pendingPayload?.registros.length ?? 0} registros no arquivo. Escolha mesclar
          (mantém os seus e atualiza IDs coincidentes se o arquivo for mais novo) ou substituir
          (apaga os lançamentos atuais).
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1 text-sm ${importMode === 'merge' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            onClick={() => setImportMode('merge')}
          >
            Mesclar
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1 text-sm ${importMode === 'replace' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            onClick={() => setImportMode('replace')}
          >
            Substituir
          </button>
        </div>
      </ConfirmDialog>
    </div>
  )
}
