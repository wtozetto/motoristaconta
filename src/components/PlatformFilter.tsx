import type { PlatformFilter } from '../types'
import { PLATFORM_LABEL } from '../types'

const OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'uber', label: PLATFORM_LABEL.uber },
  { value: 'noventaenove', label: PLATFORM_LABEL.noventaenove },
  { value: 'indrive', label: PLATFORM_LABEL.indrive },
]

interface PlatformFilterProps {
  value: PlatformFilter
  onChange: (value: PlatformFilter) => void
}

export function PlatformFilterBar({ value, onChange }: PlatformFilterProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        Filtro de aplicativo
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filtro de aplicativo">
        {OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ${
                selected
                  ? option.value === 'uber'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : option.value === 'noventaenove'
                      ? 'bg-blue-600 text-white'
                      : option.value === 'indrive'
                        ? 'bg-orange-500 text-white'
                        : 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="platform-filter"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Com Uber, 99 ou Indrive selecionado, os cartões e gráficos usam só os ganhos daquele app.
        KM e gastos continuam do dia inteiro.
      </p>
    </fieldset>
  )
}
