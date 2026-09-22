import { NextRequest, NextResponse } from 'next/server';
import { APIError } from 'better-auth/api';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeEmail } from '@/lib/data/users';

// POST /api/auth/login — connexion (better-auth, mot de passe bcrypt)
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    let response: Response;
    try {
      response = await auth.api.signInEmail({
        body: { email: normalizeEmail(String(email)), password: String(password) },
        headers: request.headers,
        asResponse: true,
      });
    } catch (error) {
      if (error instanceof APIError) {
        const code = (error.body as { code?: string } | undefined)?.code;
        if (code === 'ACCOUNT_DISABLED') {
          return NextResponse.json({ error: 'Ce compte est désactivé' }, { status: 403 });
        }
        if (error.status === 'TOO_MANY_REQUESTS' || error.statusCode === 429) {
          return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 30 secondes' }, { status: 429 });
        }
        return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
      }
      throw error;
    }

    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status === 403 ? 403 : 401;
      const message =
        status === 429 ? 'Trop de tentatives, réessayez dans 30 secondes'
        : status === 403 ? 'Ce compte est désactivé'
        : 'Email ou mot de passe incorrect';
      return NextResponse.json({ error: message }, { status });
    }

    const payload = (await response.json()) as { user?: { id: string } };
    const user = payload.user ? await db.user.findUnique({ where: { id: payload.user.id } }) : null;
    if (!user) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }

    const out = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
    });
    // Recopie des cookies de session posés par better-auth
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') out.headers.append('set-cookie', value);
    }
    const setCookies = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
    if (setCookies && setCookies.length > 0) {
      out.headers.delete('set-cookie');
      for (const c of setCookies) out.headers.append('set-cookie', c);
    }
    return out;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erreur lors de la connexion' }, { status: 500 });
  }
}
