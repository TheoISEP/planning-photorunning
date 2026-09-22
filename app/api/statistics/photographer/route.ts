import { NextRequest, NextResponse } from 'next/server';
import { canActFor, forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { userMonthlyStats } from '@/lib/data/stats';

// GET /api/statistics/photographer[?photographerId=&year=] — stats mensuelles
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const url = new URL(request.url);
    const target = url.searchParams.get('photographerId') ?? user.id;
    if (!(await canActFor(user, target))) return forbidden();
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
    return NextResponse.json({ statistics: await userMonthlyStats(target, year, user.role) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des statistiques', error);
  }
}
