import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '../../lib/format'
import { supabase } from '../../services/supabase'

interface MonthlyPoint { month: string; users: number; revenue: number }

export function DashboardAdmin() {
  const [stats, setStats] = useState({ users: 0, activeToday: 0, activeSubscriptions: 0, revenue: 0, dueToday: 0, blocked: 0 })
  const [chart, setChart] = useState<MonthlyPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    void (async () => {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(todayStart.getTime() + 86400000)
      const [profiles, activeProfiles, blockedProfiles, subscriptions, dueToday, monthPayments, allProfiles, allPayments] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login', todayStart.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('access_blocked', true),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).gte('next_billing_date', todayStart.toISOString()).lt('next_billing_date', todayEnd.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'paid').gte('payment_date', monthStart.toISOString()),
        supabase.from('profiles').select('created_at').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString()),
        supabase.from('payments').select('amount, payment_date').eq('status', 'paid').gte('payment_date', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString()),
      ])
      const failed = [profiles, activeProfiles, blockedProfiles, subscriptions, dueToday, monthPayments, allProfiles, allPayments].find((result) => result.error)
      if (failed?.error) { setError(failed.error.message); return }
      const points: MonthlyPoint[] = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + index, 1)
        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
        const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' })
        const newUsers = (allProfiles.data ?? []).filter((row) => row.created_at?.slice(0, 7) === key).length
        const revenue = (allPayments.data ?? []).filter((row) => row.payment_date?.slice(0, 7) === key)
          .reduce((sum, row) => sum + Number(row.amount), 0)
        return { month: monthName, users: newUsers, revenue }
      })
      setChart(points)
      setStats({
        users: profiles.count ?? 0,
        activeToday: activeProfiles.count ?? 0,
        activeSubscriptions: subscriptions.count ?? 0,
        revenue: (monthPayments.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
        dueToday: dueToday.count ?? 0,
        blocked: blockedProfiles.count ?? 0,
      })
    })()
  }, [])

  const cards = [
    ['Total de usuários', stats.users.toLocaleString('pt-BR')],
    ['Ativos hoje', stats.activeToday.toLocaleString('pt-BR')],
    ['Assinaturas ativas', stats.activeSubscriptions.toLocaleString('pt-BR')],
    ['Receita do mês', formatBRL(stats.revenue)],
  ]
  return (
    <div className="space-y-6">
      <header><h2 className="text-2xl font-bold">Visão geral</h2><p className="text-sm text-slate-500">Indicadores da plataforma.</p></header>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => <article key={label} className="card p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-4"><h3 className="mb-3 font-semibold">Novos usuários por mês</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="users" fill="#148552" /></BarChart></ResponsiveContainer></div></article>
        <article className="card p-4"><h3 className="mb-3 font-semibold">Receita mensal</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => formatBRL(Number(value))} /><Bar dataKey="revenue" fill="#D4AF37" /></BarChart></ResponsiveContainer></div></article>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <article className="card p-4"><h3 className="font-semibold">Vencem hoje</h3><p className="mt-1 text-2xl font-bold">{stats.dueToday}</p></article>
        <article className="card p-4"><h3 className="font-semibold">Usuários bloqueados</h3><p className="mt-1 text-2xl font-bold">{stats.blocked}</p></article>
      </section>
    </div>
  )
}
