-- Projects created with automatic table exposure disabled do not grant table
-- privileges to service_role. Grant them explicitly (idempotent; no-op where
-- they already exist). anon/authenticated and the internal revision/rate-limit
-- tables are intentionally left untouched.
grant select, insert, update, delete on table
  public.usuarios,
  public.generadores,
  public.movimientos,
  public.destinatarios
to service_role;

notify pgrst, 'reload schema';
