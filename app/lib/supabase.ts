import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SupabaseFailureKind = 'credentials' | 'schema' | 'unknown';

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost')) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

function isValidServiceRoleKey(value: string | undefined) {
  if (!value) return false;
  if (value.startsWith('sb_secret_')) return value.length > 'sb_secret_'.length;
  return value.startsWith('eyJ') && value.split('.').length === 3;
}

const hasValidConfiguration = isValidSupabaseUrl(url) && isValidServiceRoleKey(serviceRoleKey);

export const supabaseAdmin =
  hasValidConfiguration && url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export function getPersistenceConfigurationError() {
  if (!url || !serviceRoleKey) {
    return 'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.';
  }
  if (!hasValidConfiguration) {
    return 'La configuración de Supabase no es válida.';
  }
  return null;
}

export function getSupabaseConfigurationStatus() {
  if (!url || !serviceRoleKey) return 'missing' as const;
  return hasValidConfiguration ? 'valid' as const : 'invalid' as const;
}

export function classifySupabaseFailure(error: unknown): SupabaseFailureKind {
  if (!error || typeof error !== 'object') return 'unknown';
  const candidate = error as { code?: unknown; status?: unknown; statusCode?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const status = candidate.status ?? candidate.statusCode;

  if (status === 401 || status === 403 || code === 'PGRST301') return 'credentials';
  if (code === '42P01' || code === 'PGRST204' || code === 'PGRST205') return 'schema';
  return 'unknown';
}

export function getSupabaseStatus() {
  return { configured: Boolean(supabaseAdmin), url: url ?? null };
}
