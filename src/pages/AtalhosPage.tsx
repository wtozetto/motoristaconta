import { Link } from 'react-router-dom'

const SHORTCUTS = [
  { keys: 'Alt + N', action: 'Abrir Lançamentos e focar o campo de data do novo registro' },
  { keys: 'Alt + D', action: 'Abrir o Dashboard' },
  { keys: 'Alt + S', action: 'Sincronizar com o Google Drive' },
]

export function AtalhosPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Ajuda e atalhos do teclado</h1>
        <p className="text-sm text-slate-500">
          Os atalhos não são acionados enquanto você digita em um campo de formulário.
        </p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {SHORTCUTS.map(({ keys, action }) => (
            <li key={keys} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <kbd className="w-fit rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-semibold dark:bg-slate-800">
                {keys}
              </kbd>
              <span className="text-sm text-slate-600 dark:text-slate-300">{action}</span>
            </li>
          ))}
        </ul>
      </section>
      <Link to="/dashboard" className="inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-400">
        Voltar ao Dashboard
      </Link>
    </div>
  )
}
