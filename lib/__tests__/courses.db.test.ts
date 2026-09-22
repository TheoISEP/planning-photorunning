/**
 * Tests d'intégration sur une base Postgres (DATABASE_URL). Ignorés sans base.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db';
import { setCourseStatus, syncCourseTarifs, ensureDisposForCourse } from '../data/courses';
import { setDispoStatut } from '../data/dispos';
import { weekendSummaries } from '../data/stats';
import { photographerStatut } from '../planning';

const hasDb = !!process.env.DATABASE_URL;
const suite = hasDb ? describe : describe.skip;

suite('cycle de vie d’une course', () => {
  const courseId = `course-test-${Date.now()}`;
  const users = ['u-test-a', 'u-test-b', 'u-test-c', 'u-test-d'];

  beforeAll(async () => {
    for (const id of users) {
      await db.user.upsert({
        where: { id },
        create: { id, email: `${id}@test.local`, name: id, role: 'photographer', nom: id, prenom: 'T' },
        update: {},
      });
    }
    await db.course.create({
      data: { id: courseId, nom: 'Course test', dateDebut: new Date('2026-10-03T07:00:00Z'), dateFin: new Date('2026-10-03T12:00:00Z') },
    });
    await db.$transaction((tx) => syncCourseTarifs(tx, courseId, [{ nom: '', tarifPhotographe: 300, bonusChefEquipe: 100 }]));
    await db.$transaction((tx) => ensureDisposForCourse(tx, courseId));
  });

  it('valider quelqu’un ne change pas ce qu’il voit tant que la course est en cours', async () => {
    const tarif = (await db.tarif.findFirstOrThrow({ where: { courseId } })).id;
    await setDispoStatut({ courseId, photographeId: 'u-test-a', tarifId: tarif, statut: 'available' });
    await setDispoStatut({ courseId, photographeId: 'u-test-a', tarifId: tarif, statut: 'validated' });
    await setDispoStatut({ courseId, photographeId: 'u-test-b', tarifId: tarif, statut: 'available' });
    await setDispoStatut({ courseId, photographeId: 'u-test-c', tarifId: tarif, statut: 'unavailable' });
    // u-test-d reste en attente
    const a = await db.disponibilite.findFirstOrThrow({ where: { courseId, photographeId: 'u-test-a' } });
    expect(a.decision).toBe('validated');
    expect(photographerStatut(a)).toBe('available');
  });

  it('passer en Fait publie : validé visible, dispo → refusé, attente / pas dispo → non pris', async () => {
    const r = await setCourseStatus(courseId, 'done');
    expect(r.course.statutTraitement).toBe('done');
    const rows = await db.disponibilite.findMany({ where: { courseId } });
    const by = Object.fromEntries(rows.map((d) => [d.photographeId, d]));
    expect(photographerStatut(by['u-test-a'])).toBe('validated');
    expect(photographerStatut(by['u-test-b'])).toBe('rejected');
    expect(photographerStatut(by['u-test-c'])).toBe('nonPris');
    expect(photographerStatut(by['u-test-d'])).toBe('nonPris');
    expect(rows.every((d) => d.published)).toBe(true);
    expect(rows.filter((d) => d.photographeId.startsWith('u-test-')).length).toBe(4);
  });

  it('le week-end ne compte que les courses faites', async () => {
    const w = await weekendSummaries();
    const key = '2026-10-01';
    expect(w[key]).toBeDefined();
    expect(w[key].courseIds).toContain(courseId);
    expect(w[key].photographers).toBeGreaterThanOrEqual(1);
  });

  it('ajouter un 2e jour rouvre la course : le 1er jour reste validé, le 2e est en attente', async () => {
    const first = await db.tarif.findFirstOrThrow({ where: { courseId } });
    const r = await db.$transaction((tx) =>
      syncCourseTarifs(tx, courseId, [
        { id: first.id, nom: 'Samedi', tarifPhotographe: 300, bonusChefEquipe: 100 },
        { nom: 'Dimanche', tarifPhotographe: 250, bonusChefEquipe: 100 },
      ])
    );
    expect(r.added).toBe(1);
    expect(r.reopened).toBe(true);
    const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { tarifs: true } });
    expect(course.statutTraitement).toBe('inProgress');
    expect(course.tarifs.map((t) => t.nom).sort()).toEqual(['Dimanche', 'Samedi']);
    const second = course.tarifs.find((t) => t.nom === 'Dimanche')!;
    const aDay1 = await db.disponibilite.findFirstOrThrow({ where: { courseId, photographeId: 'u-test-a', tarifId: first.id } });
    const aDay2 = await db.disponibilite.findFirstOrThrow({ where: { courseId, photographeId: 'u-test-a', tarifId: second.id } });
    expect(photographerStatut(aDay1)).toBe('validated');
    expect(aDay2.published).toBe(false);
    expect(photographerStatut(aDay2)).toBe('pending');

    // Validation du 2e jour puis nouveau passage en Fait
    await setDispoStatut({ courseId, photographeId: 'u-test-a', tarifId: second.id, statut: 'available' });
    await setDispoStatut({ courseId, photographeId: 'u-test-a', tarifId: second.id, statut: 'validated' });
    await setCourseStatus(courseId, 'done');
    const after = await db.disponibilite.findMany({ where: { courseId, photographeId: 'u-test-a' } });
    expect(after.every((d) => d.published && d.decision === 'validated')).toBe(true);
  });

  it('retirer un jour supprime ses lignes, la course garde un créneau', async () => {
    const tarifs = await db.tarif.findMany({ where: { courseId }, orderBy: { ordre: 'asc' } });
    await db.$transaction((tx) => syncCourseTarifs(tx, courseId, [{ id: tarifs[0].id, nom: '', tarifPhotographe: 300, bonusChefEquipe: 100 }]));
    const left = await db.tarif.findMany({ where: { courseId } });
    expect(left.length).toBe(1);
    const rows = await db.disponibilite.findMany({ where: { courseId } });
    expect(rows.every((d) => d.tarifId === tarifs[0].id)).toBe(true);
    await db.course.delete({ where: { id: courseId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  });
});
