import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Petites mises en forme françaises, partagées par tous les écrans. */

export const euros = (n: number) =>
  `${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}\u00a0€`;

export const dateLongue = (iso: string) => format(new Date(iso), 'EEEE d MMMM', { locale: fr });
export const dateCourte = (iso: string) => format(new Date(iso), 'EEE dd/MM', { locale: fr });
export const dateJourMois = (iso: string) => format(new Date(iso), 'd MMM', { locale: fr });
export const moisAnnee = (annee: number, mois: number) => format(new Date(annee, mois, 1), 'MMMM yyyy', { locale: fr });
export const heure = (iso: string) => format(new Date(iso), "HH'h'mm", { locale: fr });

export const premiereMajuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** « samedi 14 juin » ou « samedi 14 → dimanche 15 juin ». */
export function plageDeDates(debut: string, fin: string): string {
  const a = new Date(debut);
  const b = new Date(fin);
  if (isSameDay(a, b)) return premiereMajuscule(dateLongue(debut));
  return `${premiereMajuscule(dateLongue(debut))} → ${dateLongue(fin)}`;
}

export function ilYA(iso: string | null | undefined): string {
  if (!iso) return 'jamais';
  return formatDistanceToNowStrict(new Date(iso), { locale: fr, addSuffix: true });
}

/** « +33612345678 » → « 06 12 34 56 78 » ; les numéros étrangers restent internationaux, groupés. */
export function telephoneLisible(e164: string): string {
  const n = e164.replace(/[^\d+]/g, '');
  if (/^\+33\d{9}$/.test(n)) return `0${n.slice(3)}`.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  if (/^0\d{9}$/.test(n)) return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  if (n.startsWith('+')) return `${n.slice(0, 3)} ${n.slice(3).replace(/(\d{2,3})(?=\d)/g, '$1 ')}`.trim();
  return e164;
}

/** Numéro prêt pour tel: / sms: / WhatsApp (chiffres et +). */
export const telephoneBrut = (n: string) => n.replace(/[^\d+]/g, '');

export function initiales(prenom: string, nom: string): string {
  const a = (prenom || '').trim()[0] ?? '';
  const b = (nom || '').trim()[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

/** Recherche tolérante : minuscules, sans accents. */
export const normaliser = (s: string) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const dateHeureCourte = (iso: string) => format(new Date(iso), "d MMM yyyy 'à' HH'h'mm", { locale: fr });
