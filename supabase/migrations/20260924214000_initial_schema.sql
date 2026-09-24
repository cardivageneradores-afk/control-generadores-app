create extension if not exists pgcrypto;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text not null,
  rol text not null check (rol in ('editor', 'lector')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generadores (
  id text primary key,
  codigo text not null unique,
  modelo text not null default '',
  ubicacion text not null default 'Oficina',
  estado text not null check (estado in ('estable', 'en-oficina', 'en-transito')),
  created_at timestamptz not null default now()
);

create table if not exists public.movimientos (
  id text primary key,
  generador_id text not null references public.generadores(id) on delete cascade,
  fecha date not null,
  origen text not null,
  destino text not null,
  tipo_transporte text not null check (tipo_transporte in ('Propio', 'Local', 'Nacex')),
  estado text not null check (estado in ('pendiente', 'completado')),
  notas text,
  usuario text,
  creado_en timestamptz not null default now(),
  completado_en timestamptz
);

create table if not exists public.destinatarios (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;
alter table public.generadores enable row level security;
alter table public.movimientos enable row level security;
alter table public.destinatarios enable row level security;

-- All application access is server-side with SUPABASE_SERVICE_ROLE_KEY.
-- Do not expose that key to the browser or add permissive anonymous policies.
