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
    estado,
    usuario,
    creado_en,
    completado_en
  )
  select
    id,
    generador_id,
    fecha,
    origen,
    destino,
    tipo_transporte,
    notas,
    estado,
    usuario,
    coalesce(creado_en, now()),
    completado_en
  from jsonb_to_recordset(coalesce(p_movimientos, '[]'::jsonb)) as movement_rows(
    id text,
    generador_id text,
    fecha date,
    origen text,
    destino text,
    tipo_transporte text,
    notas text,
    estado text,
    usuario text,
    creado_en timestamptz,
    completado_en timestamptz
  );

  insert into public.destinatarios (email)
  select email
  from jsonb_array_elements_text(coalesce(p_destinatarios, '[]'::jsonb)) as recipient_rows(email);
end;
$$;

revoke all on function public.replace_app_state(jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_app_state(jsonb, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
