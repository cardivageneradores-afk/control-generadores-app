-- Registra con qué acción se completó cada movimiento (entregado/recogido) y quién lo hizo.
-- Idempotente. Aplicar manualmente en el SQL Editor de Supabase ANTES de usar los botones en producción.
-- Los movimientos ya completados quedan con resultado = null (compatibilidad hacia atrás).

alter table public.movimientos add column if not exists resultado text;
alter table public.movimientos add column if not exists completado_por text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movimientos_resultado_check' and conrelid = 'public.movimientos'::regclass
  ) then
    alter table public.movimientos
      add constraint movimientos_resultado_check
      check (resultado is null or resultado in ('entregado', 'recogido'));
  end if;
end $$;

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
    editado_en,
    resultado,
    completado_por
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
    editado_en,
    resultado,
    completado_por
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
    editado_en timestamptz,
    resultado text,
    completado_por text
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
