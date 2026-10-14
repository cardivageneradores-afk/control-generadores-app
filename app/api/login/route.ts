import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getSessionConfigurationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/app/lib/auth';
import { getStore, StoreError } from '@/app/lib/store';
import { verifyPassword } from '@/app/lib/password';
import {
  clearLoginRateLimit,
  getClientIp,
  isLoginRateLimited,
} from '@/app/lib/login-rate-limit';
import {
  classifySupabaseFailure,
  getPersistenceConfigurationError,
  getSupabaseFailureMetadata,
  supabaseAdmin,
} from '@/app/lib/supabase';

function persistenceFailureResponse(error: unknown) {
  const kind = error instanceof StoreError ? error.kind : classifySupabaseFailure(error);
  console.error('[login] Supabase persistence failure', getSupabaseFailureMetadata(error));

  if (kind === 'schema') {
    return NextResponse.json(
      { error: 'La base de datos no está actualizada. Ejecuta las migraciones de Supabase.' },
      { status: 503 },
    );
  }
  if (kind === 'credentials') {
    return NextResponse.json(
      { error: 'Las credenciales del servidor para Supabase no son válidas.' },
      { status: 503 },
    );
  }
  if (kind === 'configuration') {
    return NextResponse.json(
      { error: 'No se puede conectar con Supabase. Revisa la URL y la clave secreta del servidor.' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: 'No se pudo consultar la base de datos. Revisa la configuración y las migraciones de Supabase.' },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const configurationError = getSessionConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }
  const persistenceError = getPersistenceConfigurationError();
  const demoFallbackEnabled =
    process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_DATA === 'true';
  if (persistenceError && !demoFallbackEnabled) {
    return NextResponse.json({ error: persistenceError }, { status: 503 });
  }

  const parsedBody = await request.json().catch(() => null);
  const body =
    parsedBody && typeof parsedBody === 'object'
      ? (parsedBody as Record<string, unknown>)
      : {};
  const rawEmail = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const inputValid = rawEmail.length <= 254 && password.length <= 256;
  const email = inputValid ? rawEmail : '';

  if (!demoFallbackEnabled) {
    try {
      if (await isLoginRateLimited(
        (name, parameters) => supabaseAdmin!.rpc(name, parameters),
        email,
        getClientIp(request),
        process.env.SESSION_SECRET!,
      )) {
        return NextResponse.json(
          { error: 'Email o contraseña incorrectos. Espera unos minutos antes de volver a intentarlo.' },
          { status: 429 },
        );
      }
    } catch (error) {
      console.error('[login] Rate limit persistence failure', getSupabaseFailureMetadata(error));
      return NextResponse.json(
        { error: 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde.' },
        { status: 503 },
      );
    }
  }

  let state: Awaited<ReturnType<typeof getStore>>;
  try {
    state = await getStore();
  } catch (error) {
    return persistenceFailureResponse(error);
  }
  const user = state.usuarios.find((candidate) => candidate.email.toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  try {
    if (!inputValid || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
    }
  } catch (error) {
    console.error('[login] Password verification failure', getSupabaseFailureMetadata(error));
    return NextResponse.json(
      { error: 'No se pudo validar la cuenta. Revisa la configuración de usuarios.' },
      { status: 503 },
    );
  }

  if (!demoFallbackEnabled) {
    try {
      await clearLoginRateLimit(
        (name, parameters) => supabaseAdmin!.rpc(name, parameters),
        email,
        getClientIp(request),
        process.env.SESSION_SECRET!,
      );
    } catch (error) {
      console.error('[login] Rate limit reset failure', getSupabaseFailureMetadata(error));
      return NextResponse.json(
        { error: 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde.' },
        { status: 503 },
      );
    }
  }

  const { passwordHash: _passwordHash, ...safeUser } = user;
  const response = NextResponse.json({ ok: true, me: safeUser });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
