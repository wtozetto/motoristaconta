-- Incremental admin and recurring billing support for the schema in 001.
-- Payment credentials remain server-side; billing settings contain no secrets.

alter table public.profiles
  add column if not exists access_blocked boolean not null default false;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.plans
  add column if not exists updated_at timestamptz not null default now();

alter table public.billing_alerts
  add column if not exists billing_date date;

update public.billing_alerts b
set billing_date = coalesce(
  (select s.next_billing_date::date from public.subscriptions s where s.id = b.subscription_id),
  b.sent_at::date
)
where b.billing_date is null;

alter table public.billing_alerts
  alter column billing_date set not null;

create unique index if not exists billing_alerts_subscription_date_type_key
  on public.billing_alerts (subscription_id, billing_date, alert_type);

create unique index if not exists subscriptions_mercadopago_subscription_id_key
  on public.subscriptions (mercadopago_subscription_id);

create unique index if not exists payments_mercadopago_payment_id_key
  on public.payments (mercadopago_payment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

insert into public.system_settings (key, value)
values (
  'billing_settings',
  '{"grace_period_days":7,"maintenance_mode":false,"email_from":"","messages":{"7d_before":"Sua assinatura vence em 7 dias.","3d_before":"Faltam 3 dias para o vencimento da sua assinatura.","due_day":"Sua assinatura vence hoje. Renove para manter o acesso.","3d_late":"Pagamento pendente: o acesso será suspenso em {days} dias.","blocked":"Sua assinatura foi suspensa por falta de pagamento."}}'::jsonb
)
on conflict (key) do nothing;
