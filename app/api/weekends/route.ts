import { NextResponse } from 'next/server';
import { getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { weekendSummaries } from '@/lib/data/stats';

// GET /api/weekends — par week-end : photographes qui travaillent et nombre
// d'événements, uniquement sur les courses passées en « Fait ».
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const weekends = await weekendSummaries();
    return NextResponse.json({ weekends });
  } catch (error) {
    return serverError('Erreur lors du calcul des week-ends', error);
  }
}
