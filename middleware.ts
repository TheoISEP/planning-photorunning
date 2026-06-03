import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  // Routes publiques - laisser passer
  if (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Pas de token → redirect login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si token existe, laisser passer
  // La vérification du token et des permissions se fera dans les layouts
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/photographer/:path*'],
};
