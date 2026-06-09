import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, readAccessCookieValue } from '@/lib/access';

export async function GET() {
  const level = await readAccessCookieValue(cookies().get(ACCESS_COOKIE_NAME)?.value);

  if (!level) {
    return NextResponse.json({ level: null }, { status: 401 });
  }

  return NextResponse.json({ level });
}
