import { NextResponse } from 'next/server';
import { getStore } from '@/app/lib/store';

export async function GET() {
  const state = getStore();
  return NextResponse.json({
    ...state,
    me: state.me ?? state.usuarios[0],
  });
}
