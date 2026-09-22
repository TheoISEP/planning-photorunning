/**
 * Règles métier du planning — fonctions pures, testées dans lib/__tests__.
 *
 * Vocabulaire :
 *  - déclaration : ce que le photographe dit (pending / available / unavailable)
 *  - décision    : ce que l'admin tranche (validated / teamLeader / rejected / nonPris)
 *  - publication : la décision ne devient visible du photographe qu'au passage
 *                  de la course en « Fait ». Avant, il ne voit que sa déclaration.
 *  - statut      : la vue « à plat » servie à l'interface (compatibilité avec
 *                  l'ancien planning) — voir effectiveStatut().
 */

export const DECLARATIONS = ['pending', 'available', 'unavailable'] as const;
export const DECISIONS = ['validated', 'teamLeader', 'rejected', 'nonPris'] as const;
export const STATUTS = [...DECLARATIONS, ...DECISIONS] as const;

export type Declaration = (typeof DECLARATIONS)[number];
export type Decision = (typeof DECISIONS)[number];
export type Statut = (typeof STATUTS)[number];

export const isDeclaration = (s: string): s is Declaration =>
  (DECLARATIONS as readonly string[]).includes(s);
export const isDecision = (s: string): s is Decision => (DECISIONS as readonly string[]).includes(s);
export const isStatut = (s: string): s is Statut => (STATUTS as readonly string[]).includes(s);

export const isWorking = (s: string | null | undefined) => s === 'validated' || s === 'teamLeader';

export interface DispoState {
  declaration: Declaration;
  decision: Decision | null;
  published: boolean;
}

/**
 * Statut vu par l'admin : la décision si elle existe, sinon la déclaration.
 */
export function adminStatut(d: DispoState): Statut {
  return d.decision ?? d.declaration;
}

/**
 * Statut vu par le photographe : la décision seulement si elle est publiée,
 * sinon sa propre déclaration (il « se voit toujours en attente / dispo »).
 */
export function photographerStatut(d: DispoState): Statut {
  if (d.published && d.decision) return d.decision;
  return d.declaration;
}

export function effectiveStatut(d: DispoState, viewer: 'admin' | 'photographer'): Statut {
  return viewer === 'admin' ? adminStatut(d) : photographerStatut(d);
}

/**
 * Traduit un changement de « statut » (menu de l'admin ou du photographe)
 * en changement de déclaration / décision.
 *  - choisir une déclaration efface la décision (on revient à « pas tranché »)
 *  - choisir une décision garde la déclaration d'origine (utile pour les stats
 *    et pour savoir quoi faire au passage en Fait)
 */
export function applyStatut(current: DispoState, statut: Statut): Pick<DispoState, 'declaration' | 'decision'> {
  if (isDeclaration(statut)) {
    return { declaration: statut, decision: null };
  }
  return { declaration: current.declaration, decision: statut };
}

/**
 * Décision par défaut au passage de la course en « Fait » pour une ligne que
 * l'admin n'a pas tranchée : un « dispo » non retenu est refusé, un
 * « en attente » ou « pas dispo » est non pris.
 */
export function defaultDecision(declaration: Declaration): Decision {
  return declaration === 'available' ? 'rejected' : 'nonPris';
}

/** Ce que devient une ligne quand la course passe en « Fait ». */
export function publishDispo(d: DispoState): DispoState {
  return {
    declaration: d.declaration,
    decision: d.decision ?? defaultDecision(d.declaration),
    published: true,
  };
}

/** Montant d'une prestation pour un tarif donné. */
export function amountFor(
  decision: string | null | undefined,
  tarif: { tarifPhotographe: number; bonusChefEquipe: number },
  options: { nonRemunere?: boolean } = {}
): number {
  if (!isWorking(decision)) return 0;
  const base = Number(tarif.tarifPhotographe) || 0;
  if (options.nonRemunere) return base;
  const bonus = decision === 'teamLeader' ? Number(tarif.bonusChefEquipe) || 0 : 0;
  return base + bonus;
}

/**
 * Clé de week-end (jeudi → lundi). Deux courses de la même clé se jouent le
 * même week-end. Les dates sont lues en heure de Paris.
 */
export function weekendKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = get('weekday').replace('.', '').toLowerCase();
  const dayIndex: Record<string, number> = { dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6 };
  const dow = dayIndex[weekday] ?? 0;
  // Décalage vers le jeudi de référence
  const offset = dow === 0 ? -3 : dow === 1 ? -4 : dow === 2 ? 2 : dow === 3 ? 1 : 4 - dow;
  const base = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))));
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

/** Libellé lisible d'un week-end à partir de sa clé (jeudi). */
export function weekendLabel(key: string): string {
  const thursday = new Date(`${key}T12:00:00Z`);
  const saturday = new Date(thursday);
  saturday.setUTCDate(saturday.getUTCDate() + 2);
  const sunday = new Date(thursday);
  sunday.setUTCDate(sunday.getUTCDate() + 3);
  const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
  const s = fmt.format(saturday);
  const d = fmt.format(sunday);
  const sameMonth = s.split(' ')[1] === d.split(' ')[1];
  return sameMonth ? `${s.split(' ')[0]} et ${d}` : `${s} et ${d}`;
}

/** Identifiant déterministe d'une disponibilité. */
export function dispoId(courseId: string, photographeId: string, tarifId: string): string {
  return `dispo-${courseId}-${photographeId}-${tarifId}`;
}

/** Identifiant d'un tarif (créneau) : lisible et unique. */
export function tarifId(courseId: string, ordre: number): string {
  return `tarif-${courseId}-${ordre + 1}-${Date.now().toString(36)}`;
}
