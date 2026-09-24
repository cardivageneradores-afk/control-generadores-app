import { NextResponse } from 'next/server';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME } from '@/app/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());
  return response;
}
