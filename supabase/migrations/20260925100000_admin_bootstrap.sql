create or replace function public.bootstrap_first_editor(
  p_email text,
  p_nombre text,
  p_password_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('control-generadores:first-admin', 0));
  if exists (select 1 from public.usuarios limit 1) then
    raise exception 'bootstrap_already_completed';
  end if;
  insert into public.usuarios (email, nombre, rol, password_hash)
  values (lower(trim(p_email)), trim(p_nombre), 'editor', p_password_hash)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.bootstrap_first_editor(text, text, text) from public;
grant execute on function public.bootstrap_first_editor(text, text, text) to service_role;
