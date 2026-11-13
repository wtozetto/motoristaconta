import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getAccessToken, supabase } from '../../services/supabase'

interface Profile {
  id: string
  name: string | null
  email: string | null
  role: string
  access_blocked: boolean
  last_login: string | null
  plan: string
  subscriptionStatus: string | null
}

export function UsersAdmin() {
  const [users, setUsers] = useState<Profile[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [noticeUser, setNoticeUser] = useState<Profile | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase) return
    const [profiles, subscriptions] = await Promise.all([
      supabase.from('profiles').select('id, name, email, role, access_blocked, last_login, created_at').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('user_id, status, created_at, plans(name)').order('created_at', { ascending: false }),
    ])
    if (profiles.error || subscriptions.error) {
      setError(profiles.error?.message ?? subscriptions.error?.message ?? 'Falha ao carregar usuários.')
      return
    }
    const latestSubscription = new Map<string, { status: string; plan: string }>()
    for (const item of subscriptions.data ?? []) {
      if (!latestSubscription.has(item.user_id)) {
        latestSubscription.set(item.user_id, {
          status: item.status,
          plan: item.plans?.[0]?.name ?? item.status,
        })
      }
    }
    setUsers((profiles.data ?? []).map((user) => {
      const current = latestSubscription.get(user.id)
      return { ...user, plan: current?.plan ?? '—', subscriptionStatus: current?.status ?? null } as Profile
    }))
    setError(null)
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => users.filter((user) => {
    const searchMatches = `${user.name ?? ''} ${user.email ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    const blocked = user.access_blocked || user.subscriptionStatus === 'suspended'
    const active = !blocked && ['active', 'pending', 'trial'].includes(user.subscriptionStatus ?? '')
    const statusMatches = filter === 'all'
      || (filter === 'blocked' && blocked)
      || (filter === 'active' && active)
      || (filter === 'expired' && !active && !blocked)
    return searchMatches && statusMatches
  }), [users, query, filter])

  async function toggleBlocked(user: Profile) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('profiles')
      .update({ access_blocked: !user.access_blocked }).eq('id', user.id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  async function sendNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!noticeUser) return
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: noticeUser.id, title, message }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Falha ao enviar.')
      setNoticeUser(null); setTitle(''); setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar a notificação.')
    }
  }

  return (
    <section className="space-y-4">
      <header><h2 className="text-2xl font-bold">Usuários</h2><p className="text-sm text-slate-500">Consulte acessos e controle o bloqueio da conta.</p></header>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input aria-label="Buscar usuário" placeholder="Buscar nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 flex-1 rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" />
        <select aria-label="Filtrar usuários" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="all">Todos</option><option value="active">Ativos</option><option value="expired">Vencidos/sem plano</option><option value="blocked">Bloqueados</option></select>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Nome', 'E-mail', 'Plano', 'Status', 'Último acesso', 'Ações'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead>
          <tbody>{filtered.map((user) => <tr key={user.id} className="border-t dark:border-slate-800"><td className="p-3">{user.name || '—'}{user.role === 'admin' ? <span className="ml-2 text-xs text-emerald-700">Admin</span> : null}</td><td className="p-3">{user.email}</td><td className="p-3">{user.plan}</td><td className="p-3">{user.access_blocked ? 'Bloqueado pelo admin' : user.subscriptionStatus ?? 'Sem assinatura'}</td><td className="p-3">{user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : '—'}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => void toggleBlocked(user)} className="rounded-lg border px-2 py-1 text-xs">{user.access_blocked ? 'Desbloquear' : 'Bloquear'}</button><button type="button" onClick={() => setNoticeUser(user)} className="rounded-lg border px-2 py-1 text-xs">Notificar</button></div></td></tr>)}</tbody>
        </table>
      </div>
      {noticeUser ? <form onSubmit={(event) => void sendNotice(event)} className="card space-y-3 p-4"><h3 className="font-semibold">Enviar para {noticeUser.email}</h3><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /><textarea required maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Mensagem" className="w-full rounded-lg border p-3 dark:border-slate-700 dark:bg-slate-950" /><div className="flex gap-2"><button className="btn-primary rounded-lg px-4 py-2 text-sm">Enviar notificação</button><button type="button" onClick={() => setNoticeUser(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div></form> : null}
    </section>
  )
}
