import { db } from '../db';
import { amountFor, isWorking, weekendKey, weekendLabel } from '../planning';

const parisYearMonth = (d: Date) => {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric' }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
};

export interface MonthlyUserStat {
  photographeId: string;
  mois: number;
  annee: number;
  nombreCourses: number;
  nombrePrestations: number;
  montantTotal: number;
  heuresTravail: number;
  tauxReussite: number;
  coursesDetails: Array<{ courseId: string; nom: string; ville: string; date: string; montant: number; statut: string; tarif: string }>;
}

/**
 * Stats mensuelles d'un utilisateur (photographe ou admin) sur une année.
 * viewer = photographer : ne compte que les décisions publiées.
 */
export async function userMonthlyStats(userId: string, year: number, viewer: 'admin' | 'photographer'): Promise<MonthlyUserStat[]> {
  const [user, dispos] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { nonRemunere: true, role: true } }),
    db.disponibilite.findMany({
      where: { photographeId: userId, decision: { in: ['validated', 'teamLeader'] }, course: { annulee: false }, ...(viewer === 'photographer' ? { published: true } : {}) },
      include: { course: true, tarif: true },
    }),
  ]);
  const nonRemunere = !!user?.nonRemunere;
  const byMonth = new Map<string, MonthlyUserStat>();
  const coursesCounted = new Map<string, Set<string>>();

  for (const d of dispos) {
    const { year: y, month } = parisYearMonth(d.course.dateDebut);
    if (y !== year) continue;
    const key = `${y}-${month}`;
    let stat = byMonth.get(key);
    if (!stat) {
      stat = { photographeId: userId, mois: month, annee: y, nombreCourses: 0, nombrePrestations: 0, montantTotal: 0, heuresTravail: 0, tauxReussite: 100, coursesDetails: [] };
      byMonth.set(key, stat);
      coursesCounted.set(key, new Set());
    }
    const counted = coursesCounted.get(key)!;
    if (!counted.has(d.courseId)) {
      counted.add(d.courseId);
      stat.nombreCourses++;
    }
    stat.nombrePrestations++;
    const montant = amountFor(d.decision, d.tarif, { nonRemunere });
    stat.montantTotal += montant;
    stat.heuresTravail += (d.tarif.nombreJours || 1) * 8;
    stat.coursesDetails.push({
      courseId: d.courseId,
      nom: d.course.nom,
      ville: d.course.ville,
      date: d.course.dateDebut.toISOString(),
      montant,
      statut: d.decision ?? '',
      tarif: d.tarif.nom,
    });
  }

  return [...byMonth.values()]
    .map((s) => ({ ...s, coursesDetails: s.coursesDetails.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.annee - b.annee || a.mois - b.mois);
}

export interface MonthlyAdminStat {
  mois: number;
  annee: number;
  nombreCourses: number;
  nombrePrestations: number;
  coutTotal: number;
  nombrePhotographes: number;
}

/** Stats globales par mois (toutes courses de l'année, admins non rémunérés à 0 €). */
export async function adminMonthlyStats(year: number): Promise<MonthlyAdminStat[]> {
  const courses = await db.course.findMany({
    where: { annulee: false },
    include: { disponibilites: { where: { decision: { in: ['validated', 'teamLeader'] } }, include: { tarif: true, photographe: { select: { nonRemunere: true } } } } },
  });
  const byMonth = new Map<string, MonthlyAdminStat & { set: Set<string> }>();
  for (const c of courses) {
    const { year: y, month } = parisYearMonth(c.dateDebut);
    if (y !== year) continue;
    const key = `${y}-${month}`;
    let s = byMonth.get(key);
    if (!s) {
      s = { mois: month, annee: y, nombreCourses: 0, nombrePrestations: 0, coutTotal: 0, nombrePhotographes: 0, set: new Set() };
      byMonth.set(key, s);
    }
    s.nombreCourses++;
    for (const d of c.disponibilites) {
      s.nombrePrestations++;
      s.set.add(d.photographeId);
      s.coutTotal += d.photographe.nonRemunere ? 0 : amountFor(d.decision, d.tarif);
    }
  }
  return [...byMonth.values()]
    .map(({ set, ...rest }) => ({ ...rest, nombrePhotographes: set.size }))
    .sort((a, b) => a.annee - b.annee || a.mois - b.mois);
}

export interface WeekendSummary {
  key: string;
  label: string;
  photographers: number;
  events: number;
  courseIds: string[];
}

/**
 * Pour chaque week-end : nombre de photographes qui travaillent et nombre
 * d'événements, en ne comptant QUE les courses passées en « Fait ».
 */
export async function weekendSummaries(): Promise<Record<string, WeekendSummary>> {
  const courses = await db.course.findMany({
    where: { statutTraitement: 'done', archived: false, annulee: false },
    select: {
      id: true,
      dateDebut: true,
      disponibilites: { where: { decision: { in: ['validated', 'teamLeader'] } }, select: { photographeId: true, decision: true } },
    },
  });
  const out: Record<string, WeekendSummary & { set: Set<string> }> = {};
  for (const c of courses) {
    const key = weekendKey(c.dateDebut);
    if (!out[key]) out[key] = { key, label: weekendLabel(key), photographers: 0, events: 0, courseIds: [], set: new Set() };
    const w = out[key];
    w.events++;
    w.courseIds.push(c.id);
    for (const d of c.disponibilites) if (isWorking(d.decision)) w.set.add(d.photographeId);
  }
  const result: Record<string, WeekendSummary> = {};
  for (const [k, v] of Object.entries(out)) {
    const { set, ...rest } = v;
    result[k] = { ...rest, photographers: set.size };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Classement des photographes
// ---------------------------------------------------------------------------

export interface RankingCourse {
  courseId: string;
  nom: string;
  ville: string;
  date: string;
  statut: 'validated' | 'teamLeader';
  montant: number;
  tarif: string;
}

export interface RankingEntry {
  id: string;
  prenom: string;
  nom: string;
  region: string;
  role: 'admin' | 'photographer';
  actif: boolean;
  /** true = regroupement de tous les comptes « Test » */
  test: boolean;
  courses: number;
  referent: number;
  valide: number;
  montant: number;
  details: RankingCourse[];
}

/**
 * Classement des photographes par courses validées (validé + référent) et CA
 * réalisé. Toutes les décisions (publiées ou non) sont comptées, hors courses
 * annulées et archivées-supprimées. Les comptes dont le prénom est « Test »
 * sont regroupés sous une seule ligne.
 */
export async function photographerRanking(year?: number): Promise<RankingEntry[]> {
  const [users, dispos] = await Promise.all([
    db.user.findMany({ select: { id: true, prenom: true, nom: true, region: true, role: true, actif: true, nonRemunere: true } }),
    db.disponibilite.findMany({
      where: { decision: { in: ['validated', 'teamLeader'] }, course: { annulee: false } },
      include: { course: { select: { id: true, nom: true, ville: true, dateDebut: true } }, tarif: true },
    }),
  ]);
  const byUser = new Map(users.map((u) => [u.id, u]));
  const entries = new Map<string, RankingEntry>();

  for (const d of dispos) {
    const u = byUser.get(d.photographeId);
    if (!u) continue;
    if (year && parisYearMonth(d.course.dateDebut).year !== year) continue;
    const isTest = u.prenom.trim().toLowerCase() === 'test';
    const key = isTest ? '__test__' : u.id;
    let e = entries.get(key);
    if (!e) {
      e = isTest
        ? { id: key, prenom: 'Test', nom: '(tous les comptes de test)', region: '', role: 'photographer', actif: true, test: true, courses: 0, referent: 0, valide: 0, montant: 0, details: [] }
        : { id: u.id, prenom: u.prenom, nom: u.nom, region: u.region ?? '', role: u.role, actif: u.actif, test: false, courses: 0, referent: 0, valide: 0, montant: 0, details: [] };
      entries.set(key, e);
    }
    const statut = d.decision as 'validated' | 'teamLeader';
    const montant = amountFor(statut, d.tarif, { nonRemunere: !!u.nonRemunere });
    e.details.push({ courseId: d.course.id, nom: d.course.nom, ville: d.course.ville, date: d.course.dateDebut.toISOString(), statut, montant, tarif: d.tarif.nom });
  }

  for (const e of entries.values()) {
    // Une course = un événement, même avec plusieurs créneaux validés.
    const perCourse = new Map<string, { ref: boolean; montant: number }>();
    for (const c of e.details) {
      const cur = perCourse.get(c.courseId) ?? { ref: false, montant: 0 };
      cur.ref = cur.ref || c.statut === 'teamLeader';
      cur.montant += c.montant;
      perCourse.set(c.courseId, cur);
    }
    e.courses = perCourse.size;
    e.referent = [...perCourse.values()].filter((c) => c.ref).length;
    e.valide = e.courses - e.referent;
    e.montant = [...perCourse.values()].reduce((s, c) => s + c.montant, 0);
    e.details.sort((a, b) => b.date.localeCompare(a.date));
  }

  return [...entries.values()].sort((a, b) => b.courses - a.courses || b.montant - a.montant || `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'));
}
