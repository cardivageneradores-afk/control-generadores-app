export interface SupabaseEnvironment {
  [name: string]: string | undefined;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function resolveSupabaseConfiguration(environment: SupabaseEnvironment) {
  return {
    url: environment.SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY,
    credentialVariable: environment.SUPABASE_SECRET_KEY
      ? 'SUPABASE_SECRET_KEY'
      : environment.SUPABASE_SERVICE_ROLE_KEY
        ? 'SUPABASE_SERVICE_ROLE_KEY'
        : null,
  };
}

export function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' ||
        (parsed.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

export function isValidSupabaseServerKey(value: string | undefined) {
  if (!value) return false;
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) return true;
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}
