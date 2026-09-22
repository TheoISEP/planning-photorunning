import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Garde légère : sans cookie de session better-auth, retour à /login.
// La vérification réelle (session valide, rôle) est faite par /api/auth/me
// dans les layouts et par chaque route API.
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/photographer/:path*'],
};
