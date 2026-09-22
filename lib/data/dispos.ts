import type { Disponibilite } from '@prisma/client';
import { db } from '../db';
import { applyStatut, dispoId, isDeclaration, type Statut } from '../planning';

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
  if (tarifId) {
    const t = await db.tarif.findFirst({ where: { id: tarifId, courseId }, select: { id: true } });
    if (t) return t.id;
  }
  const first = await db.tarif.findFirst({ where: { courseId }, orderBy: { ordre: 'asc' }, select: { id: true } });
  return first?.id ?? null;
}

/**
 * Applique un statut sur une ligne (créée si besoin).
 * Une déclaration efface la décision ; une décision garde la déclaration.
 */
export async function setDispoStatut(input: SetStatutInput): Promise<Disponibilite> {
  const tarifId = await resolveTarifId(input.courseId, input.tarifId);
  if (!tarifId) throw new Error('Cette course n’a aucun créneau tarifé');

  const id = dispoId(input.courseId, input.photographeId, tarifId);
  const existing = await db.disponibilite.findUnique({
    where: { courseId_photographeId_tarifId: { courseId: input.courseId, photographeId: input.photographeId, tarifId } },
  });

  const current = existing ?? { declaration: 'pending' as const, decision: null, published: false };
  const next = applyStatut(current, input.statut);
  const now = new Date();

  if (existing) {
    return db.disponibilite.update({
      where: { id: existing.id },
      data: {
        declaration: next.declaration,
        decision: next.decision,
        dateModification: now,
        ...(isDeclaration(input.statut) ? { dateDeclaration: now } : {}),
        ...(input.noteAdmin !== undefined ? { noteAdmin: input.noteAdmin } : {}),
      },
    });
  }

  return db.disponibilite.create({
    data: {
      id,
      courseId: input.courseId,
      photographeId: input.photographeId,
      tarifId,
      declaration: next.declaration,
      decision: next.decision,
      noteAdmin: input.noteAdmin ?? '',
      dateDeclaration: now,
      dateModification: now,
    },
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
