import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, canActFor, forbidden, getSessionUser, serverError, unauthorized, type SessionUser } from '@/lib/api-auth';
import { photographerCanEdit, resolveTarifId, setDispoStatut } from '@/lib/data/dispos';
import { courseInclude } from '@/lib/data/courses';
import { isDeclaration, isStatut } from '@/lib/planning';
import { serializeCourse, serializeDispo } from '@/lib/serialize';

/**
 * GET /api/disponibilites?courseId=&photographerId=
 *  - admin : toutes les lignes (statut = décision ou déclaration)
 *  - photographe : ses lignes (ou celles d'un photographe à charge), statut =
 *    décision publiée ou déclaration, enrichies de la course et du créneau.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const photographerId = searchParams.get('photographerId');

    if (user.role === 'admin') {
      const dispos = await db.disponibilite.findMany({
        where: { ...(courseId ? { courseId } : {}), ...(photographerId ? { photographeId: photographerId } : {}) },
      });
      return NextResponse.json({ disponibilites: dispos.map((d) => serializeDispo(d, 'admin')) });
    }

    // Photographe
    if (courseId && !photographerId) {
      // Vue « qui est sur cette course » : uniquement ce qui est publié et retenu
      const dispos = await db.disponibilite.findMany({
        where: { courseId, published: true, decision: { in: ['validated', 'teamLeader'] } },
      });
      return NextResponse.json({ disponibilites: dispos.map((d) => serializeDispo(d, 'photographer')) });
    }

    const target = photographerId ?? user.id;
    if (!(await canActFor(user, target))) return forbidden();

    const dispos = await db.disponibilite.findMany({
      where: { photographeId: target, ...(courseId ? { courseId } : {}) },
      include: { course: { include: courseInclude }, tarif: true },
    });

    const enriched = dispos.map((d) => {
      const course = serializeCourse(d.course);
      return {
        ...serializeDispo(d, 'photographer'),
        course: {
          ...course,
          tarifPhotographe: d.tarif.tarifPhotographe,
          bonusChefEquipe: d.tarif.bonusChefEquipe,
          tarifDescription: d.tarif.nom,
          tarifNombreJours: d.tarif.nombreJours,
        },
      };
    });
    return NextResponse.json({ disponibilites: enriched });
  } catch (error) {
    return serverError('Erreur lors de la récupération des disponibilités', error);
  }
}

async function applyChange(user: SessionUser, body: Record<string, unknown>): Promise<NextResponse> {
  const courseId = typeof body.courseId === 'string' ? body.courseId : null;
  const photographeId = typeof body.photographeId === 'string' ? body.photographeId : null;
  const statut = typeof body.statut === 'string' ? body.statut : null;
  const requestedTarif = typeof body.tarifId === 'string' && body.tarifId ? body.tarifId : null;

  if (!courseId || !photographeId || !statut) return badRequest('courseId, photographeId et statut requis');
  if (!isStatut(statut)) return badRequest('Statut invalide');

  if (!(await canActFor(user, photographeId))) {
    return forbidden('Vous ne pouvez modifier que vos disponibilités ou celles de vos photographes à charge');
  }

  const tarifId = await resolveTarifId(courseId, requestedTarif);
  if (!tarifId) return badRequest('Course sans créneau tarifé');

  if (user.role === 'photographer') {
    if (!isDeclaration(statut)) return forbidden('Vous ne pouvez indiquer que : en attente, disponible ou pas disponible');
    const check = await photographerCanEdit(courseId, photographeId, tarifId);
    if (!check.ok) return forbidden(check.reason);
  }

  const dispo = await setDispoStatut({
    courseId,
    photographeId,
    tarifId,
    statut,
    noteAdmin: user.role === 'admin' && typeof body.noteAdmin === 'string' ? body.noteAdmin : undefined,
  });
  return NextResponse.json({ disponibilite: serializeDispo(dispo, user.role), success: true });
}

// POST /api/disponibilites — créer / déclarer (même sémantique que PATCH)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return await applyChange(user, (await request.json()) as Record<string, unknown>);
  } catch (error) {
    return serverError('Erreur lors de la création de la disponibilité', error);
  }
}

// PATCH /api/disponibilites — changer le statut d'une ligne (créée si absente)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return await applyChange(user, (await request.json()) as Record<string, unknown>);
  } catch (error) {
    return serverError('Erreur lors de la modification de la disponibilité', error);
  }
}

// PUT /api/disponibilites — mise à jour en masse (admin)
// body : { courseId, statut, disponibilites: [{ photographeId, tarifId? }] }
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const body = (await request.json()) as { courseId?: string; statut?: string; disponibilites?: Array<{ photographeId?: string; tarifId?: string }> };
    if (!body.courseId || !body.statut || !Array.isArray(body.disponibilites) || body.disponibilites.length === 0) {
      return badRequest('courseId, statut et disponibilites requis');
    }
    if (!isStatut(body.statut)) return badRequest('Statut invalide');
    const results = [];
    for (const item of body.disponibilites) {
      if (!item.photographeId) continue;
      const d = await setDispoStatut({ courseId: body.courseId, photographeId: item.photographeId, tarifId: item.tarifId ?? null, statut: body.statut });
      results.push(serializeDispo(d, 'admin'));
    }
    return NextResponse.json({ success: true, count: results.length, disponibilites: results });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour en masse', error);
  }
}
