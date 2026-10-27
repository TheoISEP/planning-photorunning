import type { Course, Decision, Declaration, Dispo, Statut, Tarif } from './types';

/**
 * Règles du planning, reprises À L'IDENTIQUE du site (lib/planning.ts et
 * PhotographerBoard.tsx du planning) pour que le téléphone affiche exactement
 * ce que montre jecourse.fr, hors ligne compris. Fonctions pures, testées
 * (tests/planning.test.ts).
 */

export const DECLARATIONS: Declaration[] = ['pending', 'available', 'unavailable'];
export const DECISIONS: Decision[] = ['validated', 'teamLeader', 'rejected', 'nonPris'];

export const estDeclaration = (s: string): s is Declaration => (DECLARATIONS as string[]).includes(s);
export const estTravail = (s: string | null | undefined) => s === 'validated' || s === 'teamLeader';

/** Décision par défaut au passage en « Fait » : un dispo non retenu est refusé, le reste non pris. */
export function decisionParDefaut(d: Declaration): Decision {
  return d === 'available' ? 'rejected' : 'nonPris';
}

/** Ce que l'admin voit : la décision si elle existe, sinon la déclaration. */
export function statutAdmin(d: Pick<Dispo, 'declaration' | 'decision'>): Statut {
  return d.decision ?? d.declaration;
}

/** Choisir un statut : une déclaration efface la décision, une décision garde la déclaration. */
export function appliquerStatut(d: Pick<Dispo, 'declaration' | 'decision'>, statut: Statut): Pick<Dispo, 'declaration' | 'decision'> {
  return estDeclaration(statut) ? { declaration: statut, decision: null } : { declaration: d.declaration, decision: statut };
}

export function montant(statut: string | null | undefined, tarif: Pick<Tarif, 'tarifPhotographe' | 'bonusChefEquipe'>): number {
  if (!estTravail(statut)) return 0;
  const base = Number(tarif.tarifPhotographe) || 0;
  const bonus = statut === 'teamLeader' ? Number(tarif.bonusChefEquipe) || 0 : 0;
  return base + bonus;
}

export const cleDispo = (courseId: string, personneId: string, tarifId: string) => `${courseId}|${personneId}|${tarifId}`;

export interface VueCreneau {
  tarif: Tarif;
  dispo: Dispo | null;
  statut: Statut;
  modifiable: boolean;
  montant: number;
}

export interface VueCourse {
  course: Course;
  creneaux: VueCreneau[];
  travaille: boolean;
  referent: boolean;
  montant: number;
  passee: boolean;
}

/**
 * Vue d'une course pour un photographe (PhotographerBoard.viewFor du site) :
 * course finalisée sans décision publiée → règle de publication appliquée à
 * l'affichage ; modifiable seulement tant que la course n'est pas « Fait ».
 */
export function vuePhotographe(course: Course, dispos: Map<string, Dispo>, personneId: string, maintenant = new Date()): VueCourse {
  const creneaux: VueCreneau[] = course.tarifs.map((tarif) => {
    const dispo = dispos.get(cleDispo(course.id, personneId, tarif.id)) ?? null;
    const tranche = !!dispo?.published && !!dispo?.decision;
    const statut: Statut =
      course.statutTraitement === 'done' && !tranche ? decisionParDefaut(dispo?.declaration ?? 'pending') : dispo?.statut ?? 'pending';
    const modifiable = !course.archived && !course.annulee && course.statutTraitement !== 'done' && !tranche;
    return { tarif, dispo, statut, modifiable, montant: course.annulee ? 0 : montant(statut, tarif) };
  });
  const travaille = !course.annulee && creneaux.some((c) => estTravail(c.statut));
  return {
    course,
    creneaux,
    travaille,
    referent: creneaux.some((c) => c.statut === 'teamLeader'),
    montant: creneaux.reduce((s, c) => s + c.montant, 0),
    passee: new Date(course.dateFin) < maintenant,
  };
}

/** Course cachée au photographe : tous ses créneaux refusés ou non pris. */
export function estCacheePour(v: VueCourse): boolean {
  return v.creneaux.length > 0 && v.creneaux.every((c) => c.statut === 'rejected' || c.statut === 'nonPris');
}

/**
 * Clé de week-end (jeudi → lundi), en heure de Paris. Identique au site :
 * deux courses de la même clé se jouent le même week-end.
 */
export function cleWeekend(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  const dow = base.getUTCDay();
  const decalage = dow === 0 ? -3 : dow === 1 ? -4 : dow === 2 ? 2 : dow === 3 ? 1 : 4 - dow;
  base.setUTCDate(base.getUTCDate() + decalage);
  return base.toISOString().slice(0, 10);
}

export interface GroupeMois {
  cle: string;
  annee: number;
  mois: number;
  courses: Course[];
}

/** Courses à venir (et archivées du mois en cours), groupées par mois, comme le site. */
export function groupesParMois(courses: Course[], mode: 'actives' | 'archives', maintenant = new Date()): GroupeMois[] {
  const visibles = courses.filter((c) => {
    if (mode === 'archives') return c.archived;
    if (!c.archived) return true;
    const d = new Date(c.dateDebut);
    return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
  });
  const groupes = new Map<string, GroupeMois>();
  for (const c of visibles) {
    const d = new Date(c.dateDebut);
    const cle = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groupes.get(cle);
    if (!g) {
      g = { cle, annee: d.getFullYear(), mois: d.getMonth(), courses: [] };
      groupes.set(cle, g);
    }
    g.courses.push(c);
  }
  const liste = [...groupes.values()].map((g) => ({ ...g, courses: g.courses.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)) }));
  liste.sort((a, b) => a.annee - b.annee || a.mois - b.mois);
  return liste;
}

/**
 * Chiffres d'une course pour l'admin, calculés comme la grille du site
 * (PlanningBoard.courseViews) : par créneau et par personne active, un admin
 * non rémunéré ne coûte rien, une course annulée non plus.
 */
export function resumeAdmin(
  course: Course,
  dispos: Map<string, Dispo>,
  colonnes: { id: string; role: string; nonRemunere: boolean }[],
) {
  let retenus = 0;
  let disponibles = 0;
  let cout = 0;
  for (const tarif of course.tarifs) {
    for (const u of colonnes) {
      const d = dispos.get(cleDispo(course.id, u.id, tarif.id));
      if (!d) continue;
      if (estTravail(d.decision)) {
        retenus++;
        if (!(u.role === 'admin' && u.nonRemunere)) cout += montant(d.decision, tarif);
      } else if (d.statut === 'available') {
        disponibles++;
      }
    }
  }
  return { retenus, disponibles, cout: course.annulee ? 0 : cout };
}

/** Ce que le passage en « Fait » va faire (même résumé que la boîte de dialogue du site). */
export function resumePassageFait(course: Course, dispos: Map<string, Dispo>, colonnes: { id: string }[]) {
  let retenus = 0;
  let versRefuse = 0;
  let versNonPris = 0;
  for (const tarif of course.tarifs) {
    for (const u of colonnes) {
      const d = dispos.get(cleDispo(course.id, u.id, tarif.id));
      if (d && estTravail(d.decision)) retenus++;
      else if (d && d.decision) continue;
      else if (d?.declaration === 'available') versRefuse++;
      else versNonPris++;
    }
  }
  return { retenus, versRefuse, versNonPris };
}
