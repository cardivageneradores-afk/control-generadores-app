import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/app/lib/password';
import {
  classifySupabaseFailure,
  getPersistenceConfigurationError,
  getSupabaseConfigurationStatus,
  getSupabaseFailureMetadata,
  supabaseAdmin,
} from '@/app/lib/supabase';
import {
  getClientIp,
  hasAdminSetupToken,
  hasSameOrigin,
  isAdminSetupAvailable,
  isRateLimited,
  isSetupTokenValid,
} from '@/app/lib/admin-setup';

export const dynamic = 'force-dynamic';

type SetupDiagnostic =
  | 'SETUP_CONFIG_MISSING'
  | 'SETUP_CONFIG_INVALID'
  | 'SETUP_SUPABASE_CREDENTIALS_INVALID'
  | 'SETUP_SUPABASE_SCHEMA_MISSING'
  | 'SETUP_SUPABASE_UNKNOWN';

function diagnosticResponse(
  diagnostic: SetupDiagnostic,
  error: string,
  status: 500 | 503,
  failure?: unknown,
) {
  const metadata = failure ? getSupabaseFailureMetadata(failure) : {};
  console.error(`[setup] ${diagnostic}`, metadata);
  return NextResponse.json({ available: false, error, diagnostic }, { status });
}

const setupSchema = z.object({
  token: z.string().min(1).max(256),
  email: z.string().trim().toLowerCase().email().max(254),
  nombre: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(256),
});

export async function GET() {
  const configurationStatus = getSupabaseConfigurationStatus();
  if (configurationStatus === 'missing') {
    return diagnosticResponse(
      'SETUP_CONFIG_MISSING',
      'Falta la configuración de Supabase.',
      503,
    );
  }
  if (configurationStatus === 'invalid' || !supabaseAdmin) {
    return diagnosticResponse(
      'SETUP_CONFIG_INVALID',
      'La configuración de Supabase no es válida.',
      503,
    );
  }

  try {
    return NextResponse.json({ available: await isAdminSetupAvailable() });
  } catch (error) {
    const failureKind = classifySupabaseFailure(error);
    if (failureKind === 'credentials') {
      return diagnosticResponse(
        'SETUP_SUPABASE_CREDENTIALS_INVALID',
        'Las credenciales de Supabase no son válidas.',
        503,
        error,
      );
    }
    if (failureKind === 'schema') {
      return diagnosticResponse(
        'SETUP_SUPABASE_SCHEMA_MISSING',
        'Falta la tabla o migración necesaria en Supabase.',
        503,
        error,
      );
    }
    if (failureKind === 'configuration') {
      return diagnosticResponse(
        'SETUP_CONFIG_INVALID',
        'No se pudo conectar con Supabase. Revisa la URL y el despliegue.',
        503,
        error,
      );
    }
    return diagnosticResponse(
      'SETUP_SUPABASE_UNKNOWN',
      'No se pudo comprobar la configuración de Supabase.',
      500,
      error,
    );
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  }
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
  }
  if (!hasAdminSetupToken()) {
    return NextResponse.json({ error: 'El alta inicial no está habilitada.' }, { status: 404 });
  }
  if (getPersistenceConfigurationError() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase no está configurado.' }, { status: 503 });
  }

  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isSetupTokenValid(parsed.success ? parsed.data.token : '')) {
    return NextResponse.json({ error: 'Datos de alta no válidos.' }, { status: 400 });
  }

  try {
    if (!(await isAdminSetupAvailable())) {
      return NextResponse.json({ error: 'El alta inicial ya se ha completado.' }, { status: 409 });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const { error } = await supabaseAdmin.rpc('bootstrap_first_editor', {
      p_email: parsed.data.email,
      p_nombre: parsed.data.nombre,
      p_password_hash: passwordHash,
    });
    if (error) {
      if (error.message.includes('bootstrap_already_completed')) {
        return NextResponse.json({ error: 'El alta inicial ya se ha completado.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const failureKind = classifySupabaseFailure(error);
    if (failureKind === 'credentials') {
      return diagnosticResponse(
        'SETUP_SUPABASE_CREDENTIALS_INVALID',
        'Las credenciales de Supabase no son válidas.',
        503,
        error,
      );
    }
    if (failureKind === 'schema') {
      return diagnosticResponse(
        'SETUP_SUPABASE_SCHEMA_MISSING',
        'Falta la tabla o migración necesaria en Supabase.',
        503,
        error,
      );
    }
    if (failureKind === 'configuration') {
      return diagnosticResponse(
        'SETUP_CONFIG_INVALID',
        'No se pudo conectar con Supabase. Revisa la URL y el despliegue.',
        503,
        error,
      );
    }
    console.error('[setup] SETUP_SUPABASE_UNKNOWN', getSupabaseFailureMetadata(error));
    return NextResponse.json({ error: 'No se pudo completar el alta inicial.' }, { status: 500 });
  }
}
