import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { courseDataFromInput, courseInclude, setCourseStatus, syncCourseTarifs, tarifsFromInput } from '@/lib/data/courses';
import { serializeCourse } from '@/lib/serialize';

type Params = { params: Promise<{ id: string }> };

// GET /api/courses/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const course = await db.course.findUnique({ where: { id }, include: courseInclude });
    if (!course) return notFound('Course introuvable');
    return NextResponse.json({ course: serializeCourse(course) });
  } catch (error) {
    return serverError('Erreur lors de la récupération de la course', error);
  }
}

// PATCH /api/courses/[id] — champs, créneaux (tarifs) et statut de traitement
//  - { statutTraitement: 'done' }  → publie les décisions (voir setCourseStatus)
//  - { tarifs: [...] }             → synchronise les créneaux (ajout = course rouverte)
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const data = (await request.json()) as Record<string, unknown>;
    const existing = await db.course.findUnique({ where: { id }, select: { id: true, statutTraitement: true } });
    if (!existing) return notFound('Course introuvable');

    const fields = courseDataFromInput(data);
    let info: { published?: number; added?: number; deleted?: number; reopened?: boolean } = {};

    if (Object.keys(fields).length > 0) {
      await db.course.update({ where: { id }, data: fields });
    }

    const tarifs = tarifsFromInput(data.tarifs);
    if (tarifs) {
      const r = await db.$transaction((tx) => syncCourseTarifs(tx, id, tarifs), { timeout: 20000 });
      info = { ...info, ...r };
    }

    if (data.statutTraitement === 'done' || data.statutTraitement === 'inProgress') {
      if (info.reopened && data.statutTraitement === 'done') {
        // Un nouveau créneau vient d'être ajouté : la course reste « En cours »
        // tant que les nouvelles réponses n'ont pas été tranchées.
      } else {
        const r = await setCourseStatus(id, data.statutTraitement);
        info.published = r.published;
      }
    } else if (data.statutTraitement !== undefined) {
      return badRequest('statutTraitement invalide');
    }

    const course = await db.course.findUniqueOrThrow({ where: { id }, include: courseInclude });
    return NextResponse.json({ course: serializeCourse(course), success: true, ...info });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour de la course', error);
  }
}

// DELETE /api/courses/[id] — suppression définitive (admin)
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    await db.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors de la suppression de la course', error);
  }
}
