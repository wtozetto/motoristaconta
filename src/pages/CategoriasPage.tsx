import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useData } from '../data/DataContext'

export function CategoriasPage() {
  const { categoriasManutencao, saveCategoriaManutencao, removeCategoriaManutencao } = useData()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await saveCategoriaManutencao(name, editing ?? undefined)
      setName('')
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a categoria.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Categorias personalizadas</h1>
        <p className="text-sm text-slate-500">
          Gerencie as categorias de gastos e manutenções disponíveis nos formulários.
        </p>
      </header>

      <form
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="flex-1 text-sm">
          {editing ? 'Editar categoria' : 'Nova categoria'}
          <input
            required
            maxLength={50}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Ex.: Lavagem detalhada"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {editing ? 'Salvar' : 'Adicionar'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setName('')
                setEditing(null)
                setError(null)
              }}
              className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
            >
              Cancelar
            </button>
          ) : null}
        </div>
        {error ? <p role="alert" className="text-sm text-rose-600 sm:basis-full">{error}</p> : null}
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Categorias cadastradas ({categoriasManutencao.length})</h2>
        {categoriasManutencao.length ? (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {categoriasManutencao.map((category) => (
              <li key={category} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium">{category}</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(category)
                      setName(category)
                      setError(null)
                    }}
                    className="text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(category)}
                    className="text-xs font-semibold text-rose-600 underline"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhuma categoria personalizada.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir categoria?"
        confirmLabel="Excluir"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeCategoriaManutencao(pendingDelete)
          setPendingDelete(null)
        }}
      >
        Os registros de manutenção existentes não serão alterados.
      </ConfirmDialog>
    </div>
  )
}
