import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '../db';
import { dispoId, tarifId as newTarifId } from '../planning';
import { toBool, toDate, toIntOrNull, toNumberOrNull } from '../serialize';

type Tx = Prisma.TransactionClient | PrismaClient;

export const courseInclude = { tarifs: { orderBy: { ordre: 'asc' as const } } };

export interface TarifInput {
  id?: string;
  nom?: string;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  nombreJours?: number;
}

/**
 * Garantit qu'il existe une ligne de disponibilité (en attente, non publiée)
 * pour chaque utilisateur actif × chaque créneau de la course.
 * Idempotent, utilisable après création de course, ajout de créneau ou de
 * compte.
 */
export async function ensureDisposForCourse(tx: Tx, courseId: string, onlyUserIds?: string[]) {
  const [tarifs, users, existing] = await Promise.all([
    tx.tarif.findMany({ where: { courseId }, select: { id: true } }),
    tx.user.findMany({
      where: { actif: true, ...(onlyUserIds ? { id: { in: onlyUserIds } } : {}) },
      select: { id: true },
    }),
    tx.disponibilite.findMany({ where: { courseId }, select: { photographeId: true, tarifId: true } }),
  ]);
  const have = new Set(existing.map((d) => `${d.photographeId}|${d.tarifId}`));
  const rows: Prisma.DisponibiliteCreateManyInput[] = [];
  for (const t of tarifs) {
    for (const u of users) {
      if (have.has(`${u.id}|${t.id}`)) continue;
      rows.push({ id: dispoId(courseId, u.id, t.id), courseId, photographeId: u.id, tarifId: t.id });
    }
  }
  if (rows.length > 0) {
    await tx.disponibilite.createMany({ data: rows, skipDuplicates: true });
  }
  return rows.length;
}

/** Crée les lignes manquantes d'un utilisateur sur toutes les courses à venir. */
export async function ensureDisposForUser(tx: Tx, userId: string) {
  const courses = await tx.course.findMany({
    where: { archived: false, statutTraitement: 'inProgress', dateFin: { gte: new Date() } },
    select: { id: true },
  });
  let n = 0;
  for (const c of courses) n += await ensureDisposForCourse(tx, c.id, [userId]);
  return n;
}

/**
 * Passage « En cours » ↔ « Fait ».
 * En « Fait », toutes les lignes de la course sont tranchées et publiées :
 *  - décision déjà prise → conservée
 *  - dispo non retenu → refusé ; en attente / pas dispo → non pris
 * Le retour en « En cours » ne dépublie rien (ce qui a été annoncé reste
 * visible) : seuls les nouveaux créneaux sont en attente de publication.
 */
export async function setCourseStatus(courseId: string, status: 'inProgress' | 'done') {
  return db.$transaction(
    async (tx) => {
      const course = await tx.course.findUnique({ where: { id: courseId }, select: { id: true } });
      if (!course) throw new Error('Course introuvable');

      if (status === 'done') {
        await ensureDisposForCourse(tx, courseId);
        const now = new Date();
        // Trois mises à jour groupées (et non une par ligne) : rapide même
        // avec une base distante.
        const rejected = await tx.disponibilite.updateMany({
          where: { courseId, decision: null, declaration: 'available' },
          data: { decision: 'rejected', dateModification: now },
        });
        const nonPris = await tx.disponibilite.updateMany({
          where: { courseId, decision: null },
          data: { decision: 'nonPris', dateModification: now },
        });
        const published = await tx.disponibilite.updateMany({
          where: { courseId, published: false },
          data: { published: true, publishedAt: now },
        });
        const updated = await tx.course.update({
          where: { id: courseId },
          data: { statutTraitement: 'done', doneAt: now },
          include: courseInclude,
        });
        return { course: updated, published: Math.max(published.count, rejected.count + nonPris.count) };
      }

      const updated = await tx.course.update({
        where: { id: courseId },
        data: { statutTraitement: 'inProgress' },
        include: courseInclude,
      });
      return { course: updated, published: 0 };
    },
    { timeout: 20000 }
  );
}

/**
 * Met à jour les créneaux (tarifs) d'une course d'après la liste voulue.
 *  - créneau avec id connu → mis à jour
 *  - sans id → créé, avec ses lignes de dispo en attente pour tout le monde
 *  - créneau absent de la liste → supprimé (ses lignes de dispo avec lui)
 * Si on AJOUTE un créneau à une course « Fait », elle repasse « En cours » :
 * les validés du premier jour restent validés (déjà publiés), le nouveau jour
 * attend les réponses puis une nouvelle validation globale.
 */
export async function syncCourseTarifs(tx: Tx, courseId: string, wanted: TarifInput[]) {
  const course = await tx.course.findUnique({ where: { id: courseId }, include: courseInclude });
  if (!course) throw new Error('Course introuvable');
  const list = wanted.length > 0 ? wanted : [{ tarifPhotographe: 0, bonusChefEquipe: 0 }];
  const keepIds = new Set<string>();
  let added = 0;

  for (let i = 0; i < list.length; i++) {
    const input = list[i];
    const data = {
      nom: list.length > 1 ? (input.nom ?? '').trim() || `Jour ${i + 1}` : (input.nom ?? '').trim(),
      ordre: i,
      tarifPhotographe: Number(input.tarifPhotographe) || 0,
      bonusChefEquipe: Number(input.bonusChefEquipe) || 0,
      nombreJours: Math.max(1, Number(input.nombreJours) || 1),
    };
    const existing = input.id ? course.tarifs.find((t) => t.id === input.id) : undefined;
    if (existing) {
      await tx.tarif.update({ where: { id: existing.id }, data });
      keepIds.add(existing.id);
    } else {
      const id = input.id && !course.tarifs.some((t) => t.id === input.id) ? input.id : newTarifId(courseId, i);
      await tx.tarif.create({ data: { id, courseId, ...data } });
      keepIds.add(id);
      added++;
    }
  }

  const toDelete = course.tarifs.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
  if (toDelete.length > 0) {
    await tx.tarif.deleteMany({ where: { id: { in: toDelete } } });
  }

  let reopened = false;
  if (added > 0) {
    await ensureDisposForCourse(tx, courseId);
    if (course.statutTraitement === 'done') {
      await tx.course.update({ where: { id: courseId }, data: { statutTraitement: 'inProgress' } });
      reopened = true;
    }
  }
  return { added, deleted: toDelete.length, reopened };
}

/** Champs de course acceptés depuis le front (formes anciennes tolérées). */
export function courseDataFromInput(data: Record<string, unknown>): Prisma.CourseUpdateInput {
  const out: Prisma.CourseUpdateInput = {};
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);

  if (str('nom') !== undefined) out.nom = str('nom')!.trim();
  if (str('description') !== undefined) out.description = str('description')!;
  if (str('localisation') !== undefined) out.localisation = str('localisation')!.trim();
  if (str('ville') !== undefined) out.ville = str('ville')!.trim();
  if (data.dateDebut !== undefined) {
    const d = toDate(data.dateDebut);
    if (d) out.dateDebut = d;
  }
  if (data.dateFin !== undefined) {
    const d = toDate(data.dateFin);
    if (d) out.dateFin = d;
  }
  if (data.coureursAttendus !== undefined) out.coureursAttendus = toIntOrNull(data.coureursAttendus);
  if (data.numberAttended !== undefined) out.numberAttended = toIntOrNull(data.numberAttended);
  if (str('briefPdfUrl') !== undefined) out.briefPdfUrl = str('briefPdfUrl') || null;
  if (data.visible !== undefined) out.visible = toBool(data.visible, true);
  if (str('hotel') !== undefined) out.hotel = str('hotel')!;
  if (str('transport') !== undefined) out.transport = str('transport')!;
  if (str('supplementaire') !== undefined) out.supplementaire = str('supplementaire')!;
  if (data.hotelValid !== undefined) out.hotelValid = toBool(data.hotelValid);
  if (data.transportValid !== undefined) out.transportValid = toBool(data.transportValid);
  if (data.hotelPrice !== undefined) out.hotelPrice = toNumberOrNull(data.hotelPrice);
  if (data.transportPrice !== undefined) out.transportPrice = toNumberOrNull(data.transportPrice);
  if (data.foodPrice !== undefined) out.foodPrice = toNumberOrNull(data.foodPrice);
  if (data.comOrga !== undefined) out.comOrga = toNumberOrNull(data.comOrga);
  return out;
}

/** Normalise la liste de créneaux envoyée par le front. */
export function tarifsFromInput(raw: unknown): TarifInput[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((t) => t && typeof t === 'object')
    .map((t) => {
      const o = t as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' && o.id ? o.id : undefined,
        nom: typeof o.nom === 'string' ? o.nom : typeof o.description === 'string' ? o.description : '',
        tarifPhotographe: toNumberOrNull(o.tarifPhotographe) ?? 0,
        bonusChefEquipe: toNumberOrNull(o.bonusChefEquipe) ?? 0,
        nombreJours: toIntOrNull(o.nombreJours) ?? 1,
      };
    });
}
