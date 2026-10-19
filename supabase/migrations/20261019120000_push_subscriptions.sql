-- Suscripciones Web Push (notificaciones a editores). Idempotente.
-- Aplicar manualmente en el SQL Editor de Supabase. Sin clave foránea a usuarios a propósito:
-- el guardado del estado reescribe la tabla usuarios.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  creado_en timestamptz not null default now()
);

create index if not exists push_subscriptions_usuario_email_idx
  on public.push_subscriptions (lower(usuario_email));

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;

grant select, insert, update, delete on table public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
