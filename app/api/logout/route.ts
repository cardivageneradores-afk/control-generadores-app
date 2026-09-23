import { NextResponse } from 'next/server';
import { setCurrentUser } from '@/app/lib/store';

export async function POST() {
  setCurrentUser(null);
  return NextResponse.json({ ok: true });
}
