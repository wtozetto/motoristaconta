import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlatformFilterBar } from '../components/PlatformFilter'
import { RegistroForm } from '../components/RegistroForm'
import { RegistroTable } from '../components/RegistroTable'
import type { PlatformFilter, Registro } from '../types'

export function LancamentosPage() {
  const { registros, saveRegistro, removeRegistro } = useData()
  const [filter, setFilter] = useState<PlatformFilter>('todas')
  const [editing, setEditing] = useState<Registro | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Registro | null>(null)

  const sorted = useMemo(
    () => [...registros].sort((a, b) => b.data.localeCompare(a.data)),
    [registros],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <p className="text-sm text-slate-500">Registre o dia de trabalho. A data começa em hoje.</p>
      </header>
      <PlatformFilterBar value={filter} onChange={setFilter} />
      <RegistroForm
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSubmit={async (input, id) => {
          await saveRegistro(input, id)
          setEditing(null)
        }}
      />
      <RegistroTable
        registros={sorted}
        filter={filter}
        onEdit={setEditing}
        onDelete={setPendingDelete}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir lançamento?"
        confirmLabel="Excluir"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeRegistro(pendingDelete.id)
          setPendingDelete(null)
        }}
      >
        Esta ação remove o registro deste navegador. Não há como desfazer, salvo se você tiver um
        backup JSON.
      </ConfirmDialog>
    </div>
  )
}
