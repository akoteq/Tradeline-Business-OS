import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CEO_ONLY = ['/', '/consolidated', '/admin'];
const BDO_ONLY = ['/bdo'];
const PUBLIC = ['/login', '/auth/set-password'];

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const token = request.cookies.get('auth_token')?.value;
  const payload = token ? decodeJwt(token) : null;

  const isExpired = payload?.exp && (payload.exp as number) * 1000 < Date.now();
  const user = payload && !isExpired ? payload : null;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user.role === 'BDO' && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/bdo';
    return NextResponse.redirect(url);
  }

  if (user.role !== 'BDO' && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (user.role === 'BDO' && (CEO_ONLY.includes(pathname) || pathname.startsWith('/admin/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/bdo';
    return NextResponse.redirect(url);
  }

  if (user.role !== 'BDO' && BDO_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
