# Control de generadores

Aplicación empresarial para gestionar generadores, movimientos, permisos y envío de resúmenes por email.

## Stack recomendado

- Next.js + TypeScript
- Supabase para autenticación, usuarios y base de datos
- Resend para envío de emails
- Vercel para despliegue

## Cómo probarla desde GitHub

GitHub no ejecuta la app web de forma pública por sí solo. Para probarla en internet debes usar un hosting como Vercel o Cloudflare Pages. GitHub sí puede alojar el código y ejecutar validaciones automáticas.

### Opción 1: probar localmente desde el repositorio

1. Clona el repositorio.
2. Copia `.env.example` a `.env.local`.
3. Instala dependencias: `npm install`
4. Ejecuta: `npm run dev`
5. Abre: `http://localhost:3000`

### Opción 2: probar en internet con Vercel

1. Conecta este repositorio a Vercel.
2. Añade las variables del entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `SESSION_SECRET` (secreto aleatorio de al menos 32 caracteres; no lo compartas)
3. Despliega desde GitHub.
4. Vercel te entregará una URL pública para probarla.

### Opción 3: validación automática en GitHub

Este repositorio incluye un workflow de CI en `.github/workflows/ci.yml` que valida:
- `npm ci`
- `npm run lint`
- `npm run build`

## Inicio rápido local

1. Instala dependencias:
   npm install
2. Copia el fichero `.env.example` a `.env.local` y rellena tus claves reales.
3. Ejecuta la app:
   npm run dev
4. Abre `http://localhost:3000`

Credenciales demo por defecto:
- Email: `admin@empresa.com`
- Contraseña: `admin123`

## Sesiones y seguridad

El login crea una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción. Su contenido es un token firmado con HMAC-SHA-256 mediante `SESSION_SECRET`; solo contiene el identificador de usuario y una fecha de expiración, nunca la contraseña. Cada ruta API valida la firma y busca el usuario antes de devolver el estado o ejecutar una acción. Logout revoca la cookie en el navegador.

Configura `SESSION_SECRET` en Vercel y en `.env.local` con un valor aleatorio de al menos 32 caracteres. El valor debe ser el mismo entre despliegues que deban aceptar las sesiones existentes. Si falta o es demasiado corta, el endpoint de login devuelve un error 503 explícito de configuración (nunca un 500); no se usa un secreto por defecto en producción.

## Cómo funcionan los emails

La acción de enviar resumen por email se realiza desde la API del backend (`/api/enviar-resumen`).

- La app toma la lista de destinatarios guardada en la base de datos.
- Genera un texto HTML y texto plano con el resumen semanal.
- Envía el email usando Resend.
- Si no hay una API key configurada, la app simula el envío para que puedas probar la lógica sin romper el flujo.

## Base de datos recomendada en Supabase

Crea estas tablas:

```sql
create table public.generadores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  modelo text,
  ubicacion text not null default 'Oficina',
  estado text not null default 'en-oficina',
  created_at timestamptz not null default now()
);

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  generador_id uuid references public.generadores(id) on delete cascade,
  fecha date not null,
  origen text not null,
  destino text not null,
  tipo_transporte text not null default 'Propio',
  estado text not null default 'pendiente',
  notas text,
  usuario text,
  created_at timestamptz not null default now(),
  completado_en timestamptz
);

create table public.destinatarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
```

## Despliegue

- Frontend: Vercel
- Base de datos y auth: Supabase
- Emails: Resend

Crea un proyecto en Supabase, conecta la app con tus variables de entorno y despliega en Vercel conectando el repo de GitHub.

## Notas de producción

- La sesión ya no depende de la memoria de una instancia serverless, pero el estado de la aplicación (destinatarios, generadores y movimientos) sigue siendo temporal en memoria y debe migrarse a Supabase antes de considerarse persistente en producción.
- La autenticación de esta versión es el flujo demo firmado; Supabase Auth y la persistencia de datos quedan pendientes.
