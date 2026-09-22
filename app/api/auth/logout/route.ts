import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const response = await auth.api.signOut({ headers: request.headers, asResponse: true });
    const out = NextResponse.json({ success: true });
    const setCookies = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const c of setCookies) out.headers.append('set-cookie', c);
    return out;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Erreur lors de la déconnexion' }, { status: 500 });
  }
}
