import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { syncCourseTarifs } from '@/lib/data/courses';
import { serializeTarif, toNumberOrNull } from '@/lib/serialize';

// GET /api/tarifs[?courseId=] — créneaux tarifés
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const courseId = new URL(request.url).searchParams.get('courseId');
    const tarifs = await db.tarif.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: [{ courseId: 'asc' }, { ordre: 'asc' }],
    });
    return NextResponse.json({ tarifs: tarifs.map((t) => serializeTarif(t)) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des tarifs', error);
  }
}

// POST /api/tarifs — ajouter un créneau à une course (admin)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const data = (await request.json()) as Record<string, unknown>;
    if (typeof data.courseId !== 'string') return badRequest('courseId requis');
    const existing = await db.tarif.findMany({ where: { courseId: data.courseId }, orderBy: { ordre: 'asc' } });
    const wanted = [
      ...existing.map((t) => ({ id: t.id, nom: t.nom, tarifPhotographe: t.tarifPhotographe, bonusChefEquipe: t.bonusChefEquipe, nombreJours: t.nombreJours })),
      {
        nom: String(data.nom ?? data.description ?? data.secondTarifName ?? data.firstTarifName ?? ''),
        tarifPhotographe: toNumberOrNull(data.tarifPhotographe) ?? 0,
        bonusChefEquipe: toNumberOrNull(data.bonusChefEquipe) ?? 0,
      },
    ];
    const result = await db.$transaction((tx) => syncCourseTarifs(tx, data.courseId as string, wanted));
    const tarifs = await db.tarif.findMany({ where: { courseId: data.courseId }, orderBy: { ordre: 'asc' } });
    return NextResponse.json({ tarif: serializeTarif(tarifs[tarifs.length - 1]), tarifs: tarifs.map((t) => serializeTarif(t)), success: true, ...result });
  } catch (error) {
    return serverError('Erreur lors de la création du tarif', error);
  }
}

// PATCH /api/tarifs — modifier un créneau { id, nom?, tarifPhotographe?, bonusChefEquipe? }
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const data = (await request.json()) as Record<string, unknown>;
    if (typeof data.id !== 'string') return badRequest('ID du tarif requis');
    const existing = await db.tarif.findUnique({ where: { id: data.id } });
    if (!existing) return notFound('Tarif introuvable');
    const nom = typeof data.nom === 'string' ? data.nom : typeof data.description === 'string' ? data.description
      : typeof data.firstTarifName === 'string' && existing.ordre === 0 ? data.firstTarifName
      : typeof data.secondTarifName === 'string' && existing.ordre === 1 ? data.secondTarifName : undefined;
    const tarif = await db.tarif.update({
      where: { id: data.id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(data.tarifPhotographe !== undefined ? { tarifPhotographe: toNumberOrNull(data.tarifPhotographe) ?? 0 } : {}),
        ...(data.bonusChefEquipe !== undefined ? { bonusChefEquipe: toNumberOrNull(data.bonusChefEquipe) ?? 0 } : {}),
        ...(data.nombreJours !== undefined ? { nombreJours: Math.max(1, Number(data.nombreJours) || 1) } : {}),
      },
    });
    return NextResponse.json({ tarif: serializeTarif(tarif), success: true });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour du tarif', error);
  }
}

// DELETE /api/tarifs?id= — supprimer un créneau (et ses disponibilités)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return badRequest('ID du tarif requis');
    const existing = await db.tarif.findUnique({ where: { id } });
    if (!existing) return notFound('Tarif introuvable');
    const count = await db.tarif.count({ where: { courseId: existing.courseId } });
    if (count <= 1) return badRequest('Une course garde au moins un créneau tarifé');
    await db.tarif.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors de la suppression du tarif', error);
  }
}
