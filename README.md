# Control de generadores

Aplicación Next.js para gestionar generadores, movimientos, usuarios y resúmenes por email. La persistencia de producción usa Supabase desde el servidor; nunca se envía la service role key al navegador.

## Desarrollo local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Sin credenciales, el fallback solo funciona si `NODE_ENV` no es `production` y se activan explícitamente `ALLOW_DEMO_DATA=true` y, para simular email, `ALLOW_DEMO_EMAIL=true`. El login demo es `admin@empresa.com` / `admin123`. No actives esos flags en producción.

## Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **Project Settings > API**, copia la **Project URL** a `NEXT_PUBLIC_SUPABASE_URL` y la clave **service_role** a `SUPABASE_SERVICE_ROLE_KEY`. La service role key es solo servidor.
3. Ejecuta `supabase/migrations/20260924214000_initial_schema.sql` en **SQL Editor**, o usa la CLI:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Define temporalmente `ADMIN_SETUP_TOKEN` en Vercel Production con un secreto aleatorio largo (por ejemplo, generado en un gestor de secretos). No lo incluyas en el repositorio.
5. Despliega de nuevo y abre `https://<tu-dominio>/setup`. Introduce el token, nombre, email y una contraseña de al menos 12 caracteres. La contraseña se hashea en el servidor; nunca se guarda ni se envía como hash desde el navegador.
6. Comprueba que puedes iniciar sesión y elimina `ADMIN_SETUP_TOKEN` de Vercel. Haz un nuevo deploy. La ruta rechaza cualquier alta después de existir un usuario y queda deshabilitada sin el token.
7. Define un `SESSION_SECRET` aleatorio de al menos 32 caracteres. La sesión es una cookie httpOnly firmada y cada request vuelve a validar el usuario y su rol en Supabase.

La app usa cuatro tablas (`usuarios`, `generadores`, `movimientos`, `destinatarios`) y RLS activado. Las rutas API acceden mediante `SUPABASE_SERVICE_ROLE_KEY`; no se crean políticas anónimas permisivas.

## Resend

1. Crea una API key en [Resend](https://resend.com/).
2. Verifica el dominio remitente en **Domains**.
3. Define `RESEND_API_KEY` y `RESEND_FROM_EMAIL`, por ejemplo `Control Generadores <no-reply@tu-dominio.com>`.
4. Añade destinatarios desde la interfaz. En producción no se usa ningún destinatario implícito y el envío falla explícitamente si falta configuración.

## Vercel

1. Importa el repositorio en Vercel.
2. En **Project Settings > Environment Variables**, configura `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `NEXT_PUBLIC_APP_URL` para Production (y Preview si procede). Solo durante el alta inicial añade `ADMIN_SETUP_TOKEN` en Production.
3. Mantén `ALLOW_DEMO_DATA` y `ALLOW_DEMO_EMAIL` sin definir o en `false`.
4. Despliega, realiza el alta en `/setup`, elimina `ADMIN_SETUP_TOKEN` y vuelve a desplegar. CI ejecuta `npm ci`, lint y build mediante `.github/workflows/ci.yml`.

## Validación

```bash
npm run lint
npm run build
```

La app devuelve `503` si falta la configuración de sesión o persistencia en un entorno no-demo, en vez de ocultar el problema con datos en memoria.
