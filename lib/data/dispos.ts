import type { Disponibilite } from '@prisma/client';
import { db } from '../db';
import { dispoId, isDeclaration, type Declaration, type Decision, type Statut } from '../planning';

export interface SetStatutInput {
  courseId: string;
  photographeId: string;
  /** créneau visé ; absent = premier créneau de la course */
  tarifId?: string | null;
  statut: Statut;
  noteAdmin?: string;
}

/** Résout le créneau visé (le premier de la course par défaut). */
export async function resolveTarifId(courseId: string, tarifId?: string | null): Promise<string | null> {
  const tarifs = await db.tarif.findMany({ where: { courseId }, orderBy: { ordre: 'asc' }, select: { id: true } });
  if (tarifId && tarifs.some((t) => t.id === tarifId)) return tarifId;
  return tarifs[0]?.id ?? null;
}

/**
 * Applique un statut sur une ligne (créée si besoin).
 * Une déclaration efface la décision ; une décision garde la déclaration.
 */
export async function setDispoStatut(input: SetStatutInput): Promise<Disponibilite> {
  const tarifId = await resolveTarifId(input.courseId, input.tarifId);
  if (!tarifId) throw new Error('Cette course n’a aucun créneau tarifé');

  const now = new Date();
  const declaring = isDeclaration(input.statut);
  const note = input.noteAdmin !== undefined ? { noteAdmin: input.noteAdmin } : {};

  // Un seul aller-retour : upsert sur la clé (course, photographe, créneau).
  return db.disponibilite.upsert({
    where: { courseId_photographeId_tarifId: { courseId: input.courseId, photographeId: input.photographeId, tarifId } },
    create: {
      id: dispoId(input.courseId, input.photographeId, tarifId),
      courseId: input.courseId,
      photographeId: input.photographeId,
      tarifId,
      declaration: declaring ? (input.statut as Declaration) : 'pending',
      decision: declaring ? null : (input.statut as Decision),
      noteAdmin: input.noteAdmin ?? '',
      dateDeclaration: now,
      dateModification: now,
    },
    update: declaring
      ? { declaration: input.statut as Declaration, decision: null, dateDeclaration: now, dateModification: now, ...note }
      : { decision: input.statut as Decision, dateModification: now, ...note },
  });
}

/** Photographe : ne peut modifier qu'une ligne non publiée, sur une course ouverte. */
export async function photographerCanEdit(courseId: string, photographeId: string, tarifId: string | null) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { archived: true, statutTraitement: true },
  });
  if (!course) return { ok: false as const, reason: 'Course introuvable' };
  if (course.archived) return { ok: false as const, reason: 'Course archivée' };
  if (course.statutTraitement === 'done') {
    return { ok: false as const, reason: 'La course est finalisée, contactez un admin' };
  }
  if (tarifId) {
    const d = await db.disponibilite.findUnique({
      where: { courseId_photographeId_tarifId: { courseId, photographeId, tarifId } },
      select: { published: true, decision: true },
    });
    if (d?.published && d.decision) {
      return { ok: false as const, reason: 'Ce créneau a déjà été tranché par l’admin' };
    }
  }
  return { ok: true as const };
}
