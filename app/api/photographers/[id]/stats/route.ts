import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canActFor, forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { userMonthlyStats } from '@/lib/data/stats';

// GET /api/photographers/[id]/stats[?year=] — stats mensuelles détaillées
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await params;
    if (!(await canActFor(user, id))) return forbidden();
    const target = await db.user.findUnique({ where: { id }, select: { id: true, nom: true, prenom: true, role: true, nonRemunere: true } });
    if (!target) return notFound('Utilisateur introuvable');
    const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear();
    const statistics = await userMonthlyStats(id, year, user.role);
    const now = new Date();
    const current = statistics.find((s) => s.annee === now.getFullYear() && s.mois === now.getMonth() + 1) ?? null;
    return NextResponse.json({
      statistics,
      photographerStats: current,
      user: { id: target.id, nom: target.nom, prenom: target.prenom, isAdmin: target.role === 'admin', isNonPaidAdmin: target.role === 'admin' && target.nonRemunere },
    });
  } catch (error) {
    return serverError('Erreur lors de la récupération des statistiques', error);
  }
}
