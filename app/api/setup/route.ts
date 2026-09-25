import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/app/lib/password';
import { getPersistenceConfigurationError, supabaseAdmin } from '@/app/lib/supabase';
import {
  getClientIp,
  hasAdminSetupToken,
  hasSameOrigin,
  isAdminSetupAvailable,
  isRateLimited,
  isSetupTokenValid,
} from '@/app/lib/admin-setup';

export const dynamic = 'force-dynamic';

const setupSchema = z.object({
  token: z.string().min(1).max(256),
  email: z.string().trim().toLowerCase().email().max(254),
  nombre: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(256),
});

export async function GET() {
  try {
    return NextResponse.json({ available: await isAdminSetupAvailable() });
  } catch {
    return NextResponse.json({ available: false }, { status: 503 });
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
      throw new Error(`Error creando el administrador: ${error.message}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo completar el alta inicial.' }, { status: 500 });
  }
}
