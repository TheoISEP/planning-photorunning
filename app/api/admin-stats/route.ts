import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { toNumberOrNull } from '@/lib/serialize';

// GET /api/admin-stats — coûts fixes mensuels
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const rows = await db.monthlyCost.findMany({ orderBy: { month: 'asc' } });
    return NextResponse.json({ stats: rows.map((r) => ({ month: r.month, softCost: r.softCost })) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des statistiques', error);
  }
}

// POST /api/admin-stats — { month: 'YYYY-MM', softCost }
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { month, softCost } = (await request.json()) as { month?: string; softCost?: unknown };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest('Le mois est requis (YYYY-MM)');
    const value = toNumberOrNull(softCost) ?? 0;
    await db.monthlyCost.upsert({ where: { month }, create: { month, softCost: value }, update: { softCost: value } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour des statistiques', error);
  }
}
