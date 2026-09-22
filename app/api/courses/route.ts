import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { courseDataFromInput, courseInclude, ensureDisposForCourse, syncCourseTarifs, tarifsFromInput } from '@/lib/data/courses';
import { serializeCourse, toDate } from '@/lib/serialize';

// GET /api/courses — toutes les courses (avec leurs créneaux)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const courses = await db.course.findMany({ include: courseInclude, orderBy: { dateDebut: 'asc' } });
    return NextResponse.json({ courses: courses.map(serializeCourse) });
  } catch (error) {
    return serverError('Erreur lors de la récupération des courses', error);
  }
}

// POST /api/courses — créer une course (admin)
// body : { nom, localisation, ville, dateDebut, dateFin, …, tarifs: [{ nom, tarifPhotographe, bonusChefEquipe }] }
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const data = (await request.json()) as Record<string, unknown>;
    if (!data.nom || !data.dateDebut || !data.dateFin) return badRequest('Champs requis manquants (nom, dates)');
    const dateDebut = toDate(data.dateDebut);
    const dateFin = toDate(data.dateFin);
    if (!dateDebut || !dateFin) return badRequest('Dates invalides');
    if (dateFin < dateDebut) return badRequest('La date de fin est avant la date de début');

    const id = typeof data.id === 'string' && data.id ? data.id : `course-${Date.now()}`;
    const base = courseDataFromInput(data);
    const tarifs = tarifsFromInput(data.tarifs) ?? [
      { tarifPhotographe: Number(data.tarifPhotographe) || 0, bonusChefEquipe: Number(data.bonusChefEquipe) || 0 },
    ];

    const course = await db.$transaction(async (tx) => {
      await tx.course.create({
        data: {
          ...(base as Record<string, unknown>),
          id,
          nom: String(data.nom).trim(),
          localisation: String(data.localisation ?? data.ville ?? '').trim(),
          ville: String(data.ville ?? data.localisation ?? '').trim(),
          dateDebut,
          dateFin,
          creePar: user.id,
        } as never,
      });
      await syncCourseTarifs(tx, id, tarifs);
      await ensureDisposForCourse(tx, id);
      return tx.course.findUniqueOrThrow({ where: { id }, include: courseInclude });
    });

    return NextResponse.json({ course: serializeCourse(course), success: true }, { status: 201 });
  } catch (error) {
    return serverError('Erreur lors de la création de la course', error);
  }
}

// PATCH /api/courses — mise à jour (compat : { id, ...champs })
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const data = (await request.json()) as Record<string, unknown>;
    if (typeof data.id !== 'string') return badRequest('ID de la course requis');
    await db.course.update({ where: { id: data.id }, data: courseDataFromInput(data) });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors de la mise à jour de la course', error);
  }
}
