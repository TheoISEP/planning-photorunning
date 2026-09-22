import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { adminMonthlyStats, userMonthlyStats } from '@/lib/data/stats';

// GET /api/statistics[?personal=true]
//  - photographe (ou admin avec personal=true) : ses stats du mois en cours
//  - admin : stats globales du mois en cours + par photographe
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const personal = new URL(request.url).searchParams.get('personal') === 'true';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (user.role === 'photographer' || personal) {
      const all = await userMonthlyStats(user.id, year, user.role);
      const current = all.find((s) => s.mois === month) ?? {
        photographeId: user.id, mois: month, annee: year, nombreCourses: 0, nombrePrestations: 0, montantTotal: 0, heuresTravail: 0, tauxReussite: 100, coursesDetails: [],
      };
      return NextResponse.json({ photographerStats: current, allStats: all });
    }

    const monthly = await adminMonthlyStats(year);
    const current = monthly.find((s) => s.mois === month) ?? null;
    return NextResponse.json({ adminStats: current, statistics: monthly });
  } catch (error) {
    return serverError('Erreur lors de la récupération des statistiques', error);
  }
}
