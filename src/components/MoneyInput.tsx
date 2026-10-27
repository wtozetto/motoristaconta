import { useEffect, useState } from 'react'
import { digitsToMoney, moneyToDigitsDisplay } from '../lib/format'

interface MoneyInputProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
}

export function MoneyInput({ id, label, value, onChange, hint }: MoneyInputProps) {
  const [text, setText] = useState(() => moneyToDigitsDisplay(value))

  useEffect(() => {
    setText(moneyToDigitsDisplay(value))
  }, [value])

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const next = digitsToMoney(event.target.value)
          setText(moneyToDigitsDisplay(next))
          onChange(next)
        }}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base tabular-nums text-slate-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
