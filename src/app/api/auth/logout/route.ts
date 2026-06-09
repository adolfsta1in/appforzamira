import { NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME } from '@/lib/access';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });
  return response;
}
