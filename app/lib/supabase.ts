import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  isValidSupabaseServerKey,
  isValidSupabaseUrl,
  resolveSupabaseConfiguration,
} from './supabase-config';

const { url, secretKey, credentialVariable } = resolveSupabaseConfiguration(process.env);

export type SupabaseFailureKind = 'credentials' | 'schema' | 'configuration' | 'unknown';

type SupabaseFailureMetadata = {
  codes: string[];
  statuses: number[];
};

const hasValidConfiguration = isValidSupabaseUrl(url) && isValidSupabaseServerKey(secretKey);

export const supabaseAdmin =
  hasValidConfiguration && url && secretKey
    ? createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export function getPersistenceConfigurationError() {
  if (!url || !secretKey) {
    return 'Supabase no está configurado. Define SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).';
  }
  if (!hasValidConfiguration) {
    return 'La configuración de Supabase no es válida. La URL debe usar HTTPS (o localhost) y la clave debe ser sb_secret_... o una service role JWT heredada.';
  }
  return null;
}

export function getSupabaseConfigurationStatus() {
  if (!url || !secretKey) return 'missing' as const;
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
    codes.includes('ECONNREFUSED') ||
    codes.includes('ECONNRESET') ||
    codes.includes('ETIMEDOUT') ||
    codes.includes('EHOSTUNREACH') ||
    codes.includes('ENETUNREACH') ||
    codes.includes('UND_ERR_CONNECT_TIMEOUT') ||
    codes.includes('UND_ERR_HEADERS_TIMEOUT') ||
    codes.includes('UND_ERR_SOCKET')
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
    ...(code && /^[A-Z0-9_.-]{1,40}$/.test(code) ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function getSupabaseStatus() {
  return {
    configured: Boolean(supabaseAdmin),
    url: url ?? null,
    credentialVariable,
  };
}
