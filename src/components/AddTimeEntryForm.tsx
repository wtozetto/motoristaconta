import { useState, type FormEvent } from 'react'
import { supabase } from '../services/supabase'
import { todayISO } from '../lib/format'

const PLATFORMS = ['Uber', '99', 'iFood', 'Rappi', 'Loggi', 'Outra']

export function AddTimeEntryForm({
  userId,
  onSuccess,
}: {
  userId: string
  onSuccess: () => void
}) {
  const [platform, setPlatform] = useState('')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedMinutes = Number(minutes)
    if (!platform || !Number.isSafeInteger(parsedMinutes) || parsedMinutes < 1) {
      setMessage('Selecione uma plataforma e informe minutos inteiros maiores que zero.')
      return
    }

    if (!supabase) {
      setMessage('O registro de tempo online exige que o Supabase esteja configurado.')
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('time_entries').insert({
        user_id: userId,
        platform,
        minutes_online: parsedMinutes,
        date,
        notes: notes.trim() || null,
      })
      if (error) throw error

      setMinutes('')
      setNotes('')
      setMessage('Tempo online registrado.')
      onSuccess()
    } catch (error) {
      setMessage(error instanceof Error ? `Não foi possível registrar: ${error.message}` : 'Não foi possível registrar o tempo online.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="font-semibold">Registrar tempo online</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Plataforma
          <select
            required
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Selecione...</option>
            {PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Data
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="text-sm">
          Minutos online
          <input
            required
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Ex.: 480"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
          />
          <span className="text-xs text-slate-500">60 minutos equivalem a 1 hora.</span>
        </label>
        <label className="text-sm">
          Observações (opcional)
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Salvar registro'}
        </button>
        {message ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
      </div>
    </form>
  )
}
