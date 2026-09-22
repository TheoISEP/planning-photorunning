import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { serializeTarif, toNumberOrNull } from '@/lib/serialize';

// PATCH /api/tarifs/[courseId] — modifie le premier créneau d'une course (compat)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { courseId } = await params;
    const data = (await request.json()) as Record<string, unknown>;
    const first = await db.tarif.findFirst({ where: { courseId }, orderBy: { ordre: 'asc' } });
    if (!first) return notFound('Tarif introuvable');
    const tarif = await db.tarif.update({
      where: { id: first.id },
      data: {
        ...(data.tarifPhotographe !== undefined ? { tarifPhotographe: toNumberOrNull(data.tarifPhotographe) ?? 0 } : {}),
        ...(data.bonusChefEquipe !== undefined ? { bonusChefEquipe: toNumberOrNull(data.bonusChefEquipe) ?? 0 } : {}),
        ...(typeof data.nom === 'string' ? { nom: data.nom } : typeof data.firstTarifName === 'string' ? { nom: data.firstTarifName } : {}),
      },
    });
    return NextResponse.json({ tarif: serializeTarif(tarif), success: true });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour du tarif', error);
  }
}
