import { NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, createAccessCookieValue, type AccessLevel } from '@/lib/access';

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: '' }));
  const fullPassword = process.env.FULL_ACCESS_PASSWORD;
  const registryPassword = process.env.REGISTRY_ACCESS_PASSWORD;

  if (!fullPassword || !registryPassword) {
    return NextResponse.json(
      { error: 'Пароли доступа не настроены в Vercel env' },
      { status: 500 },
    );
  }

  let level: AccessLevel | null = null;
  if (password === fullPassword) level = 'full';
  if (password === registryPassword) level = 'registry';

  if (!level) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  const response = NextResponse.json({ level });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: await createAccessCookieValue(level),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
