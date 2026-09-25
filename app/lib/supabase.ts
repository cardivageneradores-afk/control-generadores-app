import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SupabaseFailureKind = 'credentials' | 'schema' | 'configuration' | 'unknown';

type SupabaseFailureMetadata = {
  codes: string[];
  statuses: number[];
};

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

function getNumericStatus(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string' || !/^\d{3}$/.test(value.trim())) return undefined;
  return Number(value);
}

function collectFailureMetadata(error: unknown, seen = new Set<object>()): SupabaseFailureMetadata {
  if (!error || typeof error !== 'object' || seen.has(error)) return { codes: [], statuses: [] };
  seen.add(error);

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    status_code?: unknown;
    error?: unknown;
    cause?: unknown;
    response?: unknown;
  };
  const code = typeof candidate.code === 'string' ? candidate.code.trim().toUpperCase() : undefined;
  const status =
    getNumericStatus(candidate.status) ??
    getNumericStatus(candidate.statusCode) ??
    getNumericStatus(candidate.status_code);
  const metadata: SupabaseFailureMetadata = {
    codes: code ? [code] : [],
    statuses: status === undefined ? [] : [status],
  };
  for (const nested of [candidate.error, candidate.cause, candidate.response]) {
    const nestedMetadata = collectFailureMetadata(nested, seen);
    metadata.codes.push(...nestedMetadata.codes);
    metadata.statuses.push(...nestedMetadata.statuses);
  }
  return metadata;
}

export function classifySupabaseFailure(error: unknown): SupabaseFailureKind {
  const { codes, statuses } = collectFailureMetadata(error);

  if (
    statuses.includes(401) ||
    statuses.includes(403) ||
    codes.includes('PGRST301') ||
    codes.includes('PGRST302') ||
    codes.includes('42501')
  ) {
    return 'credentials';
  }
  if (
    codes.includes('42P01') ||
    codes.includes('42703') ||
    codes.includes('42883') ||
    codes.includes('42P10') ||
    codes.includes('PGRST202') ||
    codes.includes('PGRST204') ||
    codes.includes('PGRST205') ||
    codes.includes('PGRST206')
  ) {
    return 'schema';
  }
  if (
    statuses.includes(0) ||
    codes.includes('ENOTFOUND') ||
    codes.includes('EAI_AGAIN') ||
    codes.includes('ECONNREFUSED')
  ) {
    return 'configuration';
  }
  return 'unknown';
}

export function getSupabaseFailureMetadata(error: unknown) {
  const metadata = collectFailureMetadata(error);
  const code = metadata.codes[0];
  const status = metadata.statuses[0];
  return {
    ...(code && /^[A-Z0-9_.-]{1,32}$/.test(code) ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function getSupabaseStatus() {
  return { configured: Boolean(supabaseAdmin), url: url ?? null };
}
