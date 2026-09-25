import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './supabase';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; expiresAt: number }>();

export function hasAdminSetupToken() {
  return Boolean(process.env.ADMIN_SETUP_TOKEN);
}

export function isSetupTokenValid(value: string) {
  const configured = process.env.ADMIN_SETUP_TOKEN;
  if (!configured || !value) return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  }
  return allowed.has(origin);
}

export function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

export function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.expiresAt <= now) {
    attempts.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

export async function isAdminSetupAvailable() {
  if (!supabaseAdmin || !hasAdminSetupToken()) return false;
  const { data, error } = await supabaseAdmin.from('usuarios').select('id').limit(1);
  if (error) throw new Error(`Error comprobando usuarios: ${error.message}`);
  return data.length === 0;
}
