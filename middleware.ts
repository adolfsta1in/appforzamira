import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, readAccessCookieValue } from '@/lib/access';

const PUBLIC_PATHS = ['/login'];
const AUTH_API_PREFIX = '/api/auth';
const REGISTRY_ACCESS_PATHS = ['/registry', '/registry-test'];

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/blank.png')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  const level = await readAccessCookieValue(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (!level) {
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = level === 'full' ? '/' : '/registry';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith('/api') && level !== 'full') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (level === 'registry' && !REGISTRY_ACCESS_PATHS.includes(pathname)) {
    const registryUrl = request.nextUrl.clone();
    registryUrl.pathname = '/registry';
    registryUrl.search = '';
    return NextResponse.redirect(registryUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\.).*)'],
};
