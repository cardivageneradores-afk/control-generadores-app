import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && isIP(realIp) ? realIp : 'unknown';
}

export function createLoginRateLimitKeys(email: string, ip: string, secret: string) {
  const hash = (purpose: string, value: string) =>
    createHmac('sha256', secret).update(`login:${purpose}:${value}`).digest('hex');
  const normalizedEmail = email.trim().toLowerCase();
  return {
    ipHash: hash('ip', ip),
    identityHash: hash(
      'identity',
      normalizedEmail.length <= 254
        ? normalizedEmail
        : `invalid-email-length:${normalizedEmail.length}:${normalizedEmail.slice(0, 64)}`,
    ),
  };
}

export async function isLoginRateLimited(
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  email: string,
  ip: string,
  secret: string,
) {
  const keys = createLoginRateLimitKeys(email, ip, secret);
  const { data, error } = await rpc('consume_login_attempt', {
    p_ip_hash: keys.ipHash,
    p_identity_hash: keys.identityHash,
  });
  if (error) throw error;
  if (typeof data !== 'boolean') {
    throw new Error('Supabase returned an invalid login rate limit response.');
  }
  return data;
}

export async function clearLoginRateLimit(
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ error: { message?: string } | null }>,
  email: string,
  ip: string,
  secret: string,
) {
  const keys = createLoginRateLimitKeys(email, ip, secret);
  const { error } = await rpc('clear_login_attempts', {
    p_ip_hash: keys.ipHash,
    p_identity_hash: keys.identityHash,
  });
  if (error) throw error;
}
