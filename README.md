# Control de generadores

Aplicación Next.js para gestionar generadores, movimientos, usuarios y resúmenes por email. La persistencia de producción usa Supabase desde el servidor; nunca se envía la service role key al navegador.

Los usuarios con rol de editor pueden eliminar generadores desde su tarjeta en el panel. Para conservar el historial, no se permite eliminar un generador que tenga movimientos pendientes o completados.

## Desarrollo local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Sin credenciales, el fallback solo funciona si `NODE_ENV` no es `production` y se activan explícitamente `ALLOW_DEMO_DATA=true` y, para simular email, `ALLOW_DEMO_EMAIL=true`. El login demo es `admin@empresa.com` / `admin123`. No actives esos flags en producción.

## Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **Project Settings > API Keys** o en el diálogo **Connect**, configura la URL en `SUPABASE_URL` y la clave secreta nueva (`sb_secret_...`) en `SUPABASE_SECRET_KEY`. Son variables de servidor; la app también acepta `NEXT_PUBLIC_SUPABASE_URL` como alias heredado y `SUPABASE_SERVICE_ROLE_KEY` con una clave `service_role` JWT heredada. Se prefieren los nombres nuevos si ambos están definidos, así que no hace falta duplicar variables.
3. Las migraciones iniciales y todas las posteriores están versionadas en `supabase/migrations`; en un proyecto nuevo, aplica la carpeta completa **en orden antes de desplegar**. Incluye `20260924214000_initial_schema.sql`, `20260925100000_admin_bootstrap.sql`, `20261008110000_transactional_store.sql`, `20261009120000_fix_transactional_store_delete_guard.sql`, `20261009130000_movement_times.sql`, `20261013120000_movement_edit_tracking.sql`, `20261014120000_state_concurrency_and_login_rate_limits.sql` y `20261014130000_service_role_table_grants.sql` (8 en total). La penúltima mantiene un número de revisión transaccional para rechazar escrituras basadas en datos obsoletos y añade límites de login compartidos entre instancias. La última concede explícitamente `select, insert, update, delete` a `service_role` sobre las cuatro tablas de negocio; es necesaria en proyectos con exposición automática de tablas desactivada (sin ella la API falla con SQLSTATE `42501`) y es idempotente donde esos permisos ya existen. No toca `anon`/`authenticated` ni `app_state_revision`/`login_rate_limits`. **Antes de producción, prueba esta migración y el nuevo despliegue en staging y completa un simulacro de restauración verificado.** La migración desactiva explícitamente el RPC antiguo de 4 parámetros para evitar sobrescrituras: **en cuanto se aplique, las versiones desplegadas que aún usen ese RPC rechazarán escrituras**. Por tanto, aplica migración y despliegue compatible en una ventana controlada; no dejes la migración aplicada con la versión antigua en servicio. Si usas la CLI:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Define temporalmente `ADMIN_SETUP_TOKEN` en Vercel Production con un secreto aleatorio largo (por ejemplo, generado en un gestor de secretos). No lo incluyas en el repositorio.
5. Despliega de nuevo y abre `https://<tu-dominio>/setup`. Introduce el token, nombre, email y una contraseña de al menos 12 caracteres. La contraseña se hashea en el servidor; nunca se guarda ni se envía como hash desde el navegador.
6. Comprueba que puedes iniciar sesión y elimina `ADMIN_SETUP_TOKEN` de Vercel. Haz un nuevo deploy. La ruta rechaza cualquier alta después de existir un usuario y queda deshabilitada sin el token.
7. Define un `SESSION_SECRET` aleatorio de al menos 32 caracteres. La sesión es una cookie httpOnly firmada y cada request vuelve a validar el usuario y su rol en Supabase.

## Usuarios y roles

Roles permitidos (en minúsculas): `editor` (puede crear/editar) y `lector` (solo consulta). La forma recomendada de crear usuarios es la pantalla **Usuarios** de la app. Si insertas uno a mano en `public.usuarios`, usa exactamente esos valores:

```sql
insert into public.usuarios (email, nombre, rol, password_hash) values (...);  -- rol = 'editor' o 'lector'
update public.usuarios set rol = 'editor' where lower(email) = 'persona@empresa.com';
```

- La cookie de sesión solo guarda el identificador del usuario; el rol efectivo se lee de la base de datos en **cada petición**, así que un cambio de rol se aplica de inmediato sin cerrar sesión. La pantalla abierta se actualiza al volver a la pestaña (o al recargar).
- La app tolera mayúsculas/espacios (`Editor`), pero un rol desconocido se trata como solo lectura y se avisa en pantalla («Rol no válido»). Al crear usuarios desde la API, un rol inválido devuelve error 400.

## Entregado / Recogido (transportistas)

Cada movimiento pendiente tiene dos botones, visibles también para el rol **lector** (transportistas):

- **Recogido** (primer paso): el transportista ha recogido el generador en el origen. El movimiento **sigue activo** (estado «recogido») y el generador sigue en el **origen**; se guarda quién y cuándo (`recogido_por`, `recogido_en`) y no se puede repetir.
- **Entregado** (cierra el movimiento): solo se puede pulsar tras Recogido; el generador queda en el **destino** y el movimiento pasa a completado (`completado_por`, `completado_en`, `entregado_por`, `entregado_en`).

Se pide confirmación antes de guardar (no se puede deshacer desde la app). Se guarda qué acción fue (`resultado`), quién (`completado_por`) y cuándo (`completado_en`), y se muestra en «Actividad reciente». La **ubicación actual** del generador es el campo ubicacion: se muestra en la etiqueta superior derecha de su tarjeta (los editores pueden cambiarla pulsándola; los lectores solo la ven), se usa como origen por defecto al registrar un movimiento, en los días vacíos del calendario y en el correo semanal, y se actualiza sola al completar un movimiento (Recogido = sigue en el origen, Entregado = destino). Sin valor se usa «Oficina». En el calendario, un día sin movimiento muestra dónde está el generador según sus movimientos (en el destino desde la entrega hasta que vuelve; antes del primero y sin movimientos, la ubicación actual); la etiqueta de la tarjeta muestra dónde está hoy. Los movimientos completados antes de este cambio no mueven el generador.

**Nota del transportista**: al pulsar Entregado o Recogido se abre un cuadro con un texto opcional (máx. 500 caracteres, saneado en servidor) para indicaciones o incidencias. Solo se ejecuta al confirmar. Se guarda por separado (`nota_entrega` / `nota_recogida`), se muestra en «Actividad reciente», se incluye en la notificación push (truncada) y en el correo semanal (texto escapado). La ruta acepta `nota` en el cuerpo (opcional). Migración adicional: `supabase/migrations/20261019170000_movement_completion_notes.sql` (SQL Editor, tras las dos anteriores; sin ella la nota no se conserva).

Permisos: `POST /api/movimientos/[id]/completar` acepta sesión de editor o lector (401 sin sesión, 409 si ya estaba completado, ya recogido, o se intenta Entregado sin Recogido, 400 si la acción no es `entregado`/`recogido`) y lee el rol de la base en cada petición. El resto de rutas (crear/editar/borrar movimientos, generadores, destinatarios, usuarios, envío de resumen) siguen exigiendo editor.

**Migración**: aplica en el SQL Editor, en este orden, `supabase/migrations/20261016120000_movement_completion_result.sql` y después `supabase/migrations/20261019150000_movement_delivered_step.sql` (columnas de entrega; idempotentes). Antes de la segunda, la entrega funciona pero no se conserva quién/cuándo. Detalle de la primera: aplica `supabase/migrations/20261016120000_movement_completion_result.sql` en el SQL Editor de Supabase (idempotente) antes de usar los botones; sin ella la ubicación no se conserva tras recargar.

**Migración del flujo Recogido → Entregado**: aplica también `supabase/migrations/20261030120000_movement_pickup_step.sql` (SQL Editor, idempotente, tras las anteriores; añade `recogido_en`/`recogido_por`). Los movimientos antiguos «entregados» pendientes se cierran con Entregado; los completados con Recogido siguen contando como devueltos al origen.

## Notificaciones push a editores

Al marcar un movimiento como **Entregado** o **Recogido**, el servidor envía una notificación push a todos los editores suscritos (menos a quien lo marcó): «Generador 262 entregado en Clínica Corachan», con fecha/hora y quién lo marcó. El envío es *best-effort* (timeout de 5 s): si falla no afecta a la acción, y las suscripciones caducadas (404/410) se eliminan solas.

1. Genera las claves VAPID **una vez** en tu ordenador: `npx web-push generate-vapid-keys`. No las subas al repositorio.
2. En Vercel → Settings → Environment Variables añade: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (clave pública; también `VAPID_PUBLIC_KEY` con el mismo valor), `VAPID_PRIVATE_KEY` (clave privada) y `VAPID_SUBJECT` (`mailto:cardiva.generadores@gmail.com`). Haz un nuevo deploy (la clave pública se incorpora en el build).
3. Aplica en el SQL Editor de Supabase `supabase/migrations/20261019120000_push_subscriptions.sql` (idempotente; tabla `push_subscriptions` con RLS y permisos solo para `service_role`).
4. Cada editor pulsa **Activar notificaciones** en su dispositivo y acepta el permiso. En **iPhone** (iOS 16.4 o superior) primero hay que abrir la web en Safari, Compartir → «Añadir a pantalla de inicio», abrir la app desde el icono y entonces activarlas.

Sin las variables VAPID la función queda desactivada sin errores (el botón no aparece). Solo el rol editor puede suscribirse; el rol se lee de la base en cada petición.
## Copias de seguridad y restauración

Antes de cualquier cambio de esquema o despliegue importante, confirma en **Supabase Dashboard > Database > Backups** qué copias automáticas y retención están disponibles para el plan del proyecto. La disponibilidad de PITR, su ventana de retención y los tiempos de recuperación dependen del plan; compruébalos en el dashboard y no des por hecho que están habilitados.

Para una copia lógica adicional, instala Supabase CLI, Docker Desktop y PostgreSQL (incluye `psql`), crea una carpeta de backup **fuera del repositorio** con acceso restringido y define `SUPABASE_DB_URL` desde un gestor de secretos o una sesión segura. No guardes la URL con contraseña en el repositorio, historial de comandos o tickets. Ejecuta en PowerShell desde esa carpeta:

```powershell
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

Protege y cifra los cinco archivos, conserva la fecha y el proyecto de origen en un registro separado sin credenciales, y confirma que los archivos existen y tienen tamaño no nulo. Una copia lógica de base de datos no sustituye el respaldo de objetos de Storage ni copia secretos de Vercel/Resend.

Haz un simulacro de restauración solo en un **proyecto Supabase de staging nuevo y separado**, nunca en producción ni sobre una base con datos que quieras conservar. Configura las extensiones necesarias y define `STAGING_DATABASE_URL` de forma segura. Desde la carpeta protegida del backup, restaura en una única transacción:

```powershell
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql --dbname "$env:STAGING_DATABASE_URL"
psql --single-transaction --variable ON_ERROR_STOP=1 --file history_schema.sql --file history_data.sql --dbname "$env:STAGING_DATABASE_URL"
```

Después verifica en staging el historial y las tablas de migración, recuentos de usuarios/generadores/movimientos/destinatarios, relaciones entre generadores y movimientos, acceso de la aplicación con variables de staging y una prueba de login. Si restauras solo esquema y datos, preserva también el historial de migraciones como indica la [guía de backup/restore de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). No ejecutes `db push` hasta comprobar que el historial corresponde al esquema restaurado. Registra el resultado y el tiempo del simulacro; una copia que no se haya restaurado y verificado no se considera una recuperación probada.

Si `GET /api/setup` devuelve `503`, el campo `diagnostic` permite identificar el problema sin revelar secretos: `SETUP_CONFIG_MISSING` indica variables ausentes, `SETUP_CONFIG_INVALID` una URL o clave con formato no válido, `SETUP_SUPABASE_CREDENTIALS_INVALID` credenciales rechazadas por Supabase y `SETUP_SUPABASE_SCHEMA_MISSING` una tabla o migración ausente. Las claves aceptadas son `sb_secret_` seguido de caracteres alfanuméricos, `_` o `-`, o la service role JWT heredada con tres segmentos. Los errores inesperados usan `SETUP_SUPABASE_UNKNOWN`; el servidor registra únicamente ese código seguro.

La app usa cuatro tablas (`usuarios`, `generadores`, `movimientos`, `destinatarios`) y RLS activado. Las rutas API acceden mediante la variable secreta seleccionada (`SUPABASE_SECRET_KEY` preferida, o `SUPABASE_SERVICE_ROLE_KEY` heredada); no se crean políticas anónimas permisivas.

## Gmail (envío a destinatarios reales, sin dominio propio)

Si `GMAIL_USER` y `GMAIL_APP_PASSWORD` están definidas, el correo se envía por Gmail SMTP (nodemailer) y se ignora Resend. Se envía UN solo mensaje con todos los destinatarios en «Para» (se ven entre sí), con tiempos de espera de 10-20 s. Gmail admite hasta 100 destinatarios por mensaje; con más, se trocea en varios mensajes de máx. 100. Si Gmail rechaza una dirección o un mensaje completo, se informa de qué direcciones fallaron y el resto se entrega; si falla todo, se devuelve un error claro. Gmail permite unos 500 envíos/día; la app rechaza listas de más de 450. La ruta Resend ya enviaba un único mensaje con todos en «Para».

Pasos (usuario no técnico):
1. En la cuenta `cardiva.generadores@gmail.com` activa la verificación en dos pasos (myaccount.google.com → Seguridad).
2. En myaccount.google.com/apppasswords crea una «contraseña de aplicación» (16 letras) llamada «Control Generadores».
3. En Vercel → Settings → Environment Variables (Production) añade `GMAIL_USER=cardiva.generadores@gmail.com` y `GMAIL_APP_PASSWORD=<las 16 letras>`; redespliega.
4. Pulsa «Enviar resumen» en la app para probar. Si falla con «credenciales», revisa que la contraseña sea de aplicación, no la normal.

## Envío semanal automático

`vercel.json` programa `GET /api/cron/resumen-semanal` los lunes a las 06:00 UTC (07:00 en invierno / 08:00 en verano, hora de Madrid). Resume la semana que empieza ese lunes (lunes-domingo) a la lista de destinatarios actual; si no hay destinatarios no envía. Vercel Hobby puede retrasar el cron hasta una hora.

1. Genera un secreto largo (`openssl rand -base64 32`) y defínelo en Vercel como `CRON_SECRET` (Production); Vercel lo envía como `Authorization: Bearer`. Sin `CRON_SECRET` el endpoint responde siempre 401.
2. Aplica `supabase/migrations/20261015090000_weekly_email_runs.sql` pegándolo en el **SQL Editor** de Supabase (es idempotente). Registra una marca por semana para no enviar dos veces ante reintentos; si el envío falla del todo, la marca se libera para poder reintentar.
3. Redespliega. Para forzar una prueba: Vercel → Settings → Cron Jobs → Run. Si ya se envió esa semana devolverá `skipped: ya-enviado`.

## Resend (alternativa, solo si no hay Gmail configurado)

1. Crea una API key en [Resend](https://resend.com/).
2. Verifica el dominio remitente en **Domains**.
3. Define `RESEND_API_KEY` y `RESEND_FROM_EMAIL`, por ejemplo `Control Generadores <no-reply@tu-dominio.com>`. El remitente debe pertenecer a un dominio verificado; una clave inválida, un dominio no verificado o destinatarios no permitidos por el modo de prueba de Resend se muestran como errores concretos al enviar.
4. Añade destinatarios desde la interfaz. En producción no se usa ningún destinatario implícito y el envío falla explícitamente si falta configuración.

## Vercel

1. Importa el repositorio en Vercel.
2. Si la integración Supabase-Vercel ya creó `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, el código los acepta sin duplicarlos. Para una configuración nueva, usa `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (`sb_secret_...`) en Production (y Preview si procede). No dupliques la URL como `NEXT_PUBLIC_SUPABASE_URL` ni uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` para estas rutas de servidor. Configura también `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `NEXT_PUBLIC_APP_URL`. El logo del correo se adjunta en línea con CID para que no dependa de que el despliegue sea accesible públicamente. Solo durante el alta inicial añade `ADMIN_SETUP_TOKEN` en Production.
3. Mantén `ALLOW_DEMO_DATA` y `ALLOW_DEMO_EMAIL` sin definir o en `false`.
4. Despliega, realiza el alta en `/setup`, elimina `ADMIN_SETUP_TOKEN` y vuelve a desplegar. CI ejecuta `npm ci`, tests, lint y build mediante `.github/workflows/ci.yml`.

## Validación

```bash
npm run lint
npm test
npm run build
```

La app devuelve `503` si falta la configuración de sesión o persistencia en un entorno no-demo, en vez de ocultar el problema con datos en memoria. Las escrituras se aplican dentro de una transacción de PostgreSQL; cada snapshot lleva una revisión y una escritura concurrente obsoleta recibe `409` para que se actualice y vuelva a intentar, nunca se sobrescribe silenciosamente.
