import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { photographerRanking } from '@/lib/data/stats';

// GET /api/photographers/ranking[?year=2026] — classement (admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const y = new URL(request.url).searchParams.get('year');
    const year = y && /^\d{4}$/.test(y) ? Number(y) : undefined;
    const ranking = await photographerRanking(year);
    return NextResponse.json({ ranking, year: year ?? null });
  } catch (error) {
    return serverError('Erreur lors du calcul du classement', error);
  }
}
