import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { createUser, findUserByEmail } from '@/lib/data/users';
import { serializeUser } from '@/lib/serialize';

// GET /api/photographers — tous les photographes (sans mot de passe)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const photographers = await db.user.findMany({ where: { role: 'photographer' }, orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] });
    return NextResponse.json({ photographers: photographers.map(serializeUser) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des photographes', error);
  }
}

// POST /api/photographers — créer un photographe (admin)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const data = (await request.json()) as Record<string, unknown>;
    if (!data.email || !data.password || !data.nom || !data.prenom) return badRequest('Champs requis manquants (email, mot de passe, nom, prénom)');
    if (await findUserByEmail(String(data.email))) {
      return NextResponse.json({ error: 'Un compte avec cet email existe déjà' }, { status: 409 });
    }
    const created = await createUser({ role: 'photographer', email: String(data.email), password: String(data.password), profile: data });
    return NextResponse.json({
      photographer: serializeUser(created),
      credentials: { email: created.email, password: String(data.password) },
      success: true,
    }, { status: 201 });
  } catch (error) {
    return serverError('Erreur lors de la création du photographe', error);
  }
}
