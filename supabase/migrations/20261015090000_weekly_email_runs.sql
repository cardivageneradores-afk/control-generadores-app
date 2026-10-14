-- Marca de idempotencia del envío semanal automático (una fila por semana).
-- Idempotente. Aplicar manualmente desde el SQL Editor de Supabase.
create table if not exists public.weekly_email_runs (
  week_start date primary key,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  recipients_total integer,
  recipients_failed integer
);

alter table public.weekly_email_runs enable row level security;

grant select, insert, update, delete on table public.weekly_email_runs to service_role;

notify pgrst, 'reload schema';
