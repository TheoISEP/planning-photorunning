import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { briefsIntegrationActive, creerBriefPourCourse, synchroniserPhotographesDuBrief } from '@/lib/briefs-integration';

type Params = { params: Promise<{ id: string }> };

// POST /api/courses/[id]/brief — crée (ou retrouve) le brief de la course dans
// l'app des briefs et y pousse les photographes validés (admin).
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    if (!briefsIntegrationActive()) {
      return NextResponse.json({ error: 'Liaison briefs non configurée (BRIEFS_APP_URL / BRIEFS_INTEGRATION_KEY)' }, { status: 503 });
    }
    const { id } = await params;
    const brief = await creerBriefPourCourse(id);
    if (!brief) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 });
    const rows = await synchroniserPhotographesDuBrief(id);
    return NextResponse.json({ success: true, ...brief, photographes: rows });
  } catch (error) {
    return serverError('Erreur lors de la création du brief', error);
  }
}
