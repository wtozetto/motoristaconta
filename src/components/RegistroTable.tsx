import type { PlatformFilter, Registro } from '../types'
import { COMBUSTIVEL_LABEL } from '../types'
import { deriveRegistro } from '../lib/calculations'
import { formatBRL, formatDateISO, formatKm } from '../lib/format'
import { getCombustiveisList, getCombustivelValor } from '../lib/fuel'

interface RegistroTableProps {
  registros: Registro[]
  filter: PlatformFilter
  onEdit: (registro: Registro) => void
  onDelete: (registro: Registro) => void
}

export function RegistroTable({ registros, filter, onEdit, onDelete }: RegistroTableProps) {
  if (registros.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
        Nenhum lançamento neste filtro.
      </p>
    )
  }

  return (
    <div className="card-hover-dourado overflow-x-auto rounded-2xl border border-amber-200/60 bg-white dark:border-amber-900/30 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
          <tr>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">KM</th>
            <th className="px-3 py-2 font-medium">Ganhos</th>
            <th className="px-3 py-2 font-medium">Gastos</th>
            <th className="px-3 py-2 font-medium">Lucro</th>
            <th className="px-3 py-2 font-medium">R$/km</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => {
            const d = deriveRegistro(r, filter)
            const combustivelValor = getCombustivelValor(r.combustivel)
            const fuelList = getCombustiveisList(r).filter((f) => f.valor > 0)
            const fuelSummary =
              fuelList.length > 0
                ? fuelList
                    .map((f) => {
                      const name = COMBUSTIVEL_LABEL[f.tipo] ?? f.tipo
                      return f.litros ? `${name} (${f.litros}L)` : name
                    })
                    .join(', ')
                : combustivelValor > 0
                  ? 'Combustível'
                  : null

            return (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-medium">{formatDateISO(r.data)}</td>
                <td className="px-3 py-2 tabular-nums">{formatKm(d.km)}</td>
                <td className="px-3 py-2 tabular-nums text-dourado font-medium">
                  {formatBRL(d.totalGanhos)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  <span className="text-gastos-escuro font-medium">{formatBRL(d.totalGastos)}</span>
                  {fuelSummary ? (
                    <span className="block text-[11px] font-normal text-slate-400">
                      {fuelSummary}
                    </span>
                  ) : null}
                </td>
                <td
                  className={`px-3 py-2 tabular-nums font-semibold ${
                    d.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatBRL(d.lucroLiquido)}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatBRL(d.mediaGanhoPorKm)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-700 underline dark:text-slate-200"
                      onClick={() => onEdit(r)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 underline"
                      onClick={() => onDelete(r)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
