import type { Course, Disponibilite, Tarif, User } from '@prisma/client';
import { effectiveStatut, type Statut } from './planning';

// Formes JSON servies par l'API. Les booléens sont de vrais booléens, les
// dates des ISO strings, les listes de vraies listes.

export type Viewer = 'admin' | 'photographer';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : '');
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    nom: u.nom,
    prenom: u.prenom,
    telephone: u.telephone ?? '',
    adresse: u.adresse ?? '',
    ville: u.ville ?? '',
    codePostal: u.codePostal ?? '',
    dateNaissance: u.dateNaissance ?? '',
    dateInscription: iso(u.dateInscription),
    dateCreation: iso(u.createdAt),
    actif: u.actif,
    cameras: arr(u.cameras),
    objectifs: arr(u.objectifs),
    cartesMemoire: arr(u.cartesMemoire),
    flashs: arr(u.flashs),
    flyingBlue: u.flyingBlue ?? '',
    flyingBlueExpiry: u.flyingBlueExpiry ?? '',
    sncf: u.sncf ?? '',
    sncfExpiry: u.sncfExpiry ?? '',
    region: u.region ?? '',
    personUrgency: u.personUrgency ?? '',
    numberUrgency: u.numberUrgency ?? '',
    inCharge: u.inCharge,
    chargeOne: u.chargeOne ?? '',
    chargeTwo: u.chargeTwo ?? '',
    chargeThree: u.chargeThree ?? '',
    chargeFour: u.chargeFour ?? '',
    chargeFive: u.chargeFive ?? '',
    accord: u.accord,
    nonRemunere: u.nonRemunere,
    /** alias historique de nonRemunere */
    rem: u.nonRemunere,
  };
}

export type UserJson = ReturnType<typeof serializeUser>;

export function serializeTarif(t: Tarif, ordre?: number) {
  const index = ordre ?? t.ordre;
  return {
    id: t.id,
    courseId: t.courseId,
    nom: t.nom,
    ordre: t.ordre,
    tarifPhotographe: t.tarifPhotographe,
    bonusChefEquipe: t.bonusChefEquipe,
    nombreJours: t.nombreJours,
    dateCreation: iso(t.dateCreation),
    dateModification: iso(t.dateModification),
    /** alias historiques */
    description: t.nom,
    firstTarifName: index === 0 ? t.nom : '',
    secondTarifName: index === 1 ? t.nom : '',
  };
}

export type TarifJson = ReturnType<typeof serializeTarif>;

export function serializeCourse(c: Course & { tarifs?: Tarif[] }) {
  const tarifs = (c.tarifs ?? []).slice().sort((a, b) => a.ordre - b.ordre);
  return {
    id: c.id,
    nom: c.nom,
    description: c.description,
    localisation: c.localisation,
    ville: c.ville,
    dateDebut: iso(c.dateDebut),
    dateFin: iso(c.dateFin),
    statutTraitement: c.statutTraitement,
    doneAt: iso(c.doneAt),
    coureursAttendus: c.coureursAttendus ?? 0,
    numberAttended: c.numberAttended ?? 0,
    briefPdfUrl: c.briefPdfUrl ?? '',
    dateCreation: iso(c.dateCreation),
    creePar: c.creePar ?? '',
    visible: c.visible,
    archived: c.archived,
    archivedAt: iso(c.archivedAt),
    archivedBy: c.archivedBy ?? '',
    annulee: c.annulee,
    annuleeAt: iso(c.annuleeAt),
    hotel: c.hotel,
    transport: c.transport,
    supplementaire: c.supplementaire,
    hotelValid: c.hotelValid,
    transportValid: c.transportValid,
    hotelPrice: c.hotelPrice ?? null,
    transportPrice: c.transportPrice ?? null,
    foodPrice: c.foodPrice ?? null,
    comOrga: c.comOrga ?? null,
    /** plusieurs créneaux tarifés (jours) */
    twoPrices: tarifs.length > 1,
    tarifs: tarifs.map((t, i) => serializeTarif(t, i)),
  };
}

export type CourseJson = ReturnType<typeof serializeCourse>;

export function serializeDispo(d: Disponibilite, viewer: Viewer) {
  const statut: Statut = effectiveStatut(d, viewer);
  return {
    id: d.id,
    courseId: d.courseId,
    photographeId: d.photographeId,
    tarifId: d.tarifId,
    statut,
    declaration: d.declaration,
    // La décision brute n'est exposée qu'à l'admin (ou une fois publiée)
    decision: viewer === 'admin' || d.published ? d.decision : null,
    published: d.published,
    publishedAt: iso(d.publishedAt),
    noteAdmin: viewer === 'admin' ? d.noteAdmin : '',
    dateDeclaration: iso(d.dateDeclaration),
    dateModification: iso(d.dateModification),
  };
}

export type DispoJson = ReturnType<typeof serializeDispo>;

/** Normalise les booléens venant du front ('TRUE', 'oui', true…). */
export function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'oui', '1', 'yes'].includes(s)) return true;
    if (['false', 'non', '0', 'no', ''].includes(s)) return false;
  }
  return fallback;
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.round(n);
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter((s) => s.trim() !== '');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String).filter((s) => s.trim() !== '') : [];
    } catch {
      return v.trim() ? [v] : [];
    }
  }
  return [];
}

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
