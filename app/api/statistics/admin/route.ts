import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { adminMonthlyStats } from '@/lib/data/stats';

// GET /api/statistics/admin[?year=] — stats globales par mois
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear();
    return NextResponse.json({ statistics: await adminMonthlyStats(year) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des statistiques', error);
  }
}
