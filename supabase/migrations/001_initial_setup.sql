create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  role text not null default 'driver' check (role in ('admin', 'driver')),
  access_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, last_login)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    now()
  )
  on conflict (id) do update
  set email = excluded.email, last_login = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of email, last_sign_in_at on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, email, name, last_login)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  coalesce(last_sign_in_at, created_at)
from auth.users
on conflict (id) do update
set email = excluded.email, last_login = excluded.last_login;

create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  period_days integer not null check (period_days > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, description, price, period_days, features)
values
  ('free', 'Gratuito', 'Controle essencial para começar.', 0, 30, '["Até 50 lançamentos por mês"]'::jsonb),
  ('basic', 'Básico', 'Mais recursos para sua rotina.', 19.90, 30, '["Lançamentos ilimitados", "Lembretes", "Backup no Google Drive"]'::jsonb),
  ('premium', 'Premium', 'Todos os recursos do MotoristaConta.', 34.90, 30, '["Tudo do Básico", "Relatórios e exportação", "Suporte prioritário"]'::jsonb)
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('active', 'pending', 'canceled', 'suspended', 'trial')),
  start_date timestamptz not null,
  next_billing_date timestamptz,
  mercadopago_preference_id text,
  mercadopago_subscription_id text unique,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'expired')),
  payment_date timestamptz,
  due_date timestamptz not null,
  mercadopago_payment_id text unique,
  invoice_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('oil_change', 'ipva', 'licensing', 'insurance', 'custom')),
  title text not null,
  description text,
  due_date timestamptz not null,
  repeat_days integer check (repeat_days is null or repeat_days between 0 and 365),
  notify_days_before integer not null default 7 check (notify_days_before between 0 and 365),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('subscription_alert', 'payment_reminder', 'maintenance', 'system', 'administrative')),
  title text not null,
  message text not null,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  alert_type text not null check (alert_type in ('7d_before', '3d_before', 'due_day', '3d_late', '7d_late', 'blocked')),
  billing_date date not null,
  sent_at timestamptz not null default now(),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'both')),
  unique (subscription_id, billing_date, alert_type)
);

create table if not exists public.reminder_alerts (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  unique (reminder_id, due_date)
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value)
values (
  'billing_settings',
  '{"grace_period_days":7,"maintenance_mode":false,"email_from":"","messages":{"7d_before":"Sua assinatura vence em 7 dias.","3d_before":"Faltam 3 dias para o vencimento da sua assinatura.","due_day":"Sua assinatura vence hoje. Renove para manter o acesso.","3d_late":"Pagamento pendente: o acesso será suspenso em {days} dias.","blocked":"Sua assinatura foi suspensa por falta de pagamento."}}'::jsonb
)
on conflict (key) do nothing;

-- Dados operacionais em nuvem usam payload para preservar o formato atual do app.
create table if not exists public.lancamentos (
  id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.manutencao (
  id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists subscriptions_user_status_idx on public.subscriptions (user_id, status);
create index if not exists subscriptions_due_idx on public.subscriptions (next_billing_date) where status = 'active';
create unique index if not exists subscriptions_one_current_per_user_idx
  on public.subscriptions (user_id)
  where status in ('active', 'pending', 'trial');
create index if not exists payments_user_due_idx on public.payments (user_id, due_date desc);
create index if not exists reminders_user_due_idx on public.reminders (user_id, due_date);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.billing_alerts enable row level security;
alter table public.reminder_alerts enable row level security;
alter table public.system_settings enable row level security;
alter table public.lancamentos enable row level security;
alter table public.manutencao enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "plans_read_active_or_admin" on public.plans;
create policy "plans_read_active_or_admin" on public.plans
for select to authenticated using (is_active or (select public.is_admin()));
drop policy if exists "plans_admin_manage" on public.plans;
create policy "plans_admin_manage" on public.plans
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "subscriptions_select_owner_or_admin" on public.subscriptions;
create policy "subscriptions_select_owner_or_admin" on public.subscriptions
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "subscriptions_owner_pending_insert" on public.subscriptions;
create policy "subscriptions_owner_pending_insert" on public.subscriptions
for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists "subscriptions_admin_manage" on public.subscriptions;
create policy "subscriptions_admin_manage" on public.subscriptions
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "payments_select_owner_or_admin" on public.payments;
create policy "payments_select_owner_or_admin" on public.payments
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "payments_admin_manage" on public.payments;
create policy "payments_admin_manage" on public.payments
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "reminders_owner_or_admin" on public.reminders;
create policy "reminders_owner_or_admin" on public.reminders
for all to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "notifications_owner_or_admin" on public.notifications;
create policy "notifications_owner_or_admin" on public.notifications
for all to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "billing_alerts_select_owner_or_admin" on public.billing_alerts;
create policy "billing_alerts_select_owner_or_admin" on public.billing_alerts
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "billing_alerts_admin_manage" on public.billing_alerts;
create policy "billing_alerts_admin_manage" on public.billing_alerts
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "reminder_alerts_select_owner_or_admin" on public.reminder_alerts;
create policy "reminder_alerts_select_owner_or_admin" on public.reminder_alerts
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "reminder_alerts_admin_manage" on public.reminder_alerts;
create policy "reminder_alerts_admin_manage" on public.reminder_alerts
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "settings_admin_manage" on public.system_settings;
create policy "settings_admin_manage" on public.system_settings
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "lancamentos_owner_or_admin" on public.lancamentos;
create policy "lancamentos_owner_or_admin" on public.lancamentos
for all to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "manutencao_owner_or_admin" on public.manutencao;
create policy "manutencao_owner_or_admin" on public.manutencao
for all to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.start_subscription(p_user_id uuid, p_plan_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
  v_current public.subscriptions%rowtype;
  v_subscription_id uuid;
  v_access_blocked boolean;
begin
  select access_blocked into v_access_blocked
  from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_access_blocked then
    raise exception 'Profile is blocked' using errcode = '42501';
  end if;

  select * into v_plan from public.plans
  where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Plan not found';
  end if;

  select * into v_current from public.subscriptions
  where user_id = p_user_id and status in ('active', 'pending', 'trial')
  order by created_at desc
  limit 1
  for update;

  if found and v_current.plan_id = p_plan_id then
    return v_current.id;
  end if;
  if found and v_current.plan_id <> 'free' then
    raise exception 'An active or pending paid subscription already exists'
      using errcode = '23505';
  end if;
  if found and v_plan.price = 0 then
    return v_current.id;
  end if;

  if found then
    update public.subscriptions
    set status = 'canceled', canceled_at = now(), updated_at = now()
    where id = v_current.id;
  end if;

  insert into public.subscriptions (user_id, plan_id, status, start_date, next_billing_date)
  values (
    p_user_id,
    v_plan.id,
    case when v_plan.price = 0 then 'active' else 'pending' end,
    now(),
    now() + make_interval(days => v_plan.period_days)
  )
  returning id into v_subscription_id;
  return v_subscription_id;
end;
$$;

revoke all on function public.start_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.start_subscription(uuid, text) to service_role;

grant execute on function public.is_admin() to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.plans to authenticated;
grant insert, select, update, delete on public.subscriptions to authenticated;
grant insert, update, delete on public.plans to authenticated;
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.billing_alerts to authenticated;
grant select on public.reminder_alerts to authenticated;
grant select, insert, update, delete on public.system_settings to authenticated;
grant select, insert, update, delete on public.lancamentos, public.manutencao to authenticated;
