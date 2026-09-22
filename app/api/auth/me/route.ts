import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/api-auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération de l’utilisateur' }, { status: 500 });
  }
}
