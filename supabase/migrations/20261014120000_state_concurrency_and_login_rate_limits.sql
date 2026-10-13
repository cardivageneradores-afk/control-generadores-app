create table if not exists public.app_state_revision (
  id boolean primary key default true check (id),
  revision bigint not null default 0 check (revision >= 0)
);

insert into public.app_state_revision (id, revision)
values (true, 0)
on conflict (id) do nothing;

alter table public.app_state_revision enable row level security;
revoke all on table public.app_state_revision from public, anon, authenticated, service_role;

create or replace function public.read_app_state()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'revision', (select revision from public.app_state_revision where id = true),
    'usuarios', (select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) from public.usuarios as u),
    'generadores', (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]'::jsonb) from public.generadores as g),
    'movimientos', (select coalesce(jsonb_agg(to_jsonb(m) order by m.fecha, m.id), '[]'::jsonb) from public.movimientos as m),
    'destinatarios', (select coalesce(jsonb_agg(email order by email), '[]'::jsonb) from public.destinatarios)
  );
$$;

revoke all on function public.read_app_state() from public;
grant execute on function public.read_app_state() to service_role;

create or replace function public.bump_app_state_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.app_state_revision
  set revision = revision + 1
  where id = true;
  return null;
end;
$$;

revoke all on function public.bump_app_state_revision() from public, anon, authenticated;

drop trigger if exists usuarios_bump_app_state_revision on public.usuarios;
create trigger usuarios_bump_app_state_revision
after insert or update or delete on public.usuarios
for each statement execute function public.bump_app_state_revision();

drop trigger if exists generadores_bump_app_state_revision on public.generadores;
create trigger generadores_bump_app_state_revision
after insert or update or delete on public.generadores
for each statement execute function public.bump_app_state_revision();

drop trigger if exists movimientos_bump_app_state_revision on public.movimientos;
create trigger movimientos_bump_app_state_revision
after insert or update or delete on public.movimientos
for each statement execute function public.bump_app_state_revision();

drop trigger if exists destinatarios_bump_app_state_revision on public.destinatarios;
create trigger destinatarios_bump_app_state_revision
after insert or update or delete on public.destinatarios
for each statement execute function public.bump_app_state_revision();

create or replace function public.replace_app_state(
  p_usuarios jsonb,
  p_generadores jsonb,
  p_movimientos jsonb,
  p_destinatarios jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  raise exception 'app_state_revision_required' using errcode = '55000';
end;
$$;

create or replace function public.replace_app_state(
  p_usuarios jsonb,
  p_generadores jsonb,
  p_movimientos jsonb,
  p_destinatarios jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  current_revision bigint;
begin
  select revision
  into current_revision
  from public.app_state_revision
  where id = true
  for update;

  if p_expected_revision is null or p_expected_revision <> current_revision then
    raise exception 'app_state_revision_conflict' using errcode = '40001';
  end if;

  delete from public.movimientos where true;
  delete from public.generadores where true;
  delete from public.usuarios where true;
  delete from public.destinatarios where true;

  insert into public.usuarios (id, email, nombre, rol, password_hash)
  select id, email, nombre, rol, password_hash
  from jsonb_to_recordset(coalesce(p_usuarios, '[]'::jsonb)) as user_rows(
    id uuid,
    email text,
    nombre text,
    rol text,
    password_hash text
  );

  insert into public.generadores (id, codigo, modelo, ubicacion, estado)
  select id, codigo, modelo, ubicacion, estado
  from jsonb_to_recordset(coalesce(p_generadores, '[]'::jsonb)) as generator_rows(
    id text,
    codigo text,
    modelo text,
    ubicacion text,
    estado text
  );

  insert into public.movimientos (
    id,
    generador_id,
    fecha,
    origen,
    destino,
    tipo_transporte,
    notas,
    hora_recogida,
    hora_entrega,
    estado,
    usuario,
    creado_en,
    completado_en,
    editado_en
  )
  select
    id,
    generador_id,
    fecha,
    origen,
    destino,
    tipo_transporte,
    notas,
    hora_recogida,
    hora_entrega,
    estado,
    usuario,
    coalesce(creado_en, now()),
    completado_en,
    editado_en
  from jsonb_to_recordset(coalesce(p_movimientos, '[]'::jsonb)) as movement_rows(
    id text,
    generador_id text,
    fecha date,
    origen text,
    destino text,
    tipo_transporte text,
    notas text,
    hora_recogida time,
    hora_entrega time,
    estado text,
    usuario text,
    creado_en timestamptz,
    completado_en timestamptz,
    editado_en timestamptz
  );

  insert into public.destinatarios (email)
  select email
  from jsonb_array_elements_text(coalesce(p_destinatarios, '[]'::jsonb)) as recipient_rows(email);

  update public.app_state_revision
  set revision = revision + 1
  where id = true
  returning revision into current_revision;

  return current_revision;
end;
$$;

revoke all on function public.replace_app_state(jsonb, jsonb, jsonb, jsonb, bigint) from public;
grant execute on function public.replace_app_state(jsonb, jsonb, jsonb, jsonb, bigint) to service_role;

create table if not exists public.login_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null check (attempts > 0),
  window_started_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists login_rate_limits_updated_at_idx
  on public.login_rate_limits (updated_at);

alter table public.login_rate_limits enable row level security;
revoke all on table public.login_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_login_attempt(
  p_ip_hash text,
  p_identity_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  ip_attempts integer;
  identity_attempts integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' or p_identity_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_login_rate_limit_key' using errcode = '22023';
  end if;

  with stale_keys as (
    select key_hash
    from public.login_rate_limits
    where updated_at < v_now - interval '1 day'
    order by updated_at
    limit 500
  )
  delete from public.login_rate_limits as limits
  using stale_keys
  where limits.key_hash = stale_keys.key_hash;

  insert into public.login_rate_limits (key_hash, attempts, window_started_at, updated_at)
  values (p_ip_hash, 1, v_now, v_now)
  on conflict (key_hash) do update
    set attempts = case
          when public.login_rate_limits.window_started_at <= v_now - interval '15 minutes' then 1
          else public.login_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public.login_rate_limits.window_started_at <= v_now - interval '15 minutes' then v_now
          else public.login_rate_limits.window_started_at
        end,
        updated_at = v_now
  returning attempts into ip_attempts;

  insert into public.login_rate_limits (key_hash, attempts, window_started_at, updated_at)
  values (p_identity_hash, 1, v_now, v_now)
  on conflict (key_hash) do update
    set attempts = case
          when public.login_rate_limits.window_started_at <= v_now - interval '15 minutes' then 1
          else public.login_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public.login_rate_limits.window_started_at <= v_now - interval '15 minutes' then v_now
          else public.login_rate_limits.window_started_at
        end,
        updated_at = v_now
  returning attempts into identity_attempts;

  return ip_attempts > 5 or identity_attempts > 5;
end;
$$;

revoke all on function public.consume_login_attempt(text, text) from public;
grant execute on function public.consume_login_attempt(text, text) to service_role;

create or replace function public.clear_login_attempts(
  p_ip_hash text,
  p_identity_hash text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' or p_identity_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_login_rate_limit_key' using errcode = '22023';
  end if;

  delete from public.login_rate_limits
  where key_hash = p_ip_hash or key_hash = p_identity_hash;
end;
$$;

revoke all on function public.clear_login_attempts(text, text) from public;
grant execute on function public.clear_login_attempts(text, text) to service_role;

notify pgrst, 'reload schema';
