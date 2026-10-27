import { useColorScheme } from 'react-native';
import type { Statut } from './types';

/**
 * Couleurs de l'app, reprises du planning web (Tailwind : emerald, violet,
 * amber, sky, slate, rose, orange) pour que le planning ait la même tête sur
 * le téléphone que sur jecourse.fr. Clair et sombre suivent le réglage du
 * téléphone.
 */

export interface Palette {
  sombre: boolean;
  fond: string;
  carte: string;
  carte2: string;
  texte: string;
  texteDoux: string;
  bord: string;
  bordFort: string;
  primaire: string;
  primaireTexte: string;
  primaireDoux: string;
  danger: string;
  dangerDoux: string;
  avertissement: string;
  avertissementDoux: string;
  avertissementTexte: string;
  info: string;
  // Planning
  moisFond: string;
  moisBord: string;
  moisMontant: string;
  valideFond: string;
  valideBord: string;
  valideTexte: string;
  valideFort: string;
  referentFond: string;
  referentBord: string;
  referentTexte: string;
  annuleeFond: string;
  annuleeBord: string;
  annuleeBadge: string;
  weekendFond: string;
  weekendBord: string;
  weekendTexte: string;
  weekendIcone: string;
  lien: string;
  ombre: string;
}

const clair: Palette = {
  sombre: false,
  fond: '#f6f7f9',
  carte: '#ffffff',
  carte2: '#f1f3f6',
  texte: '#151821',
  texteDoux: '#6b7280',
  bord: '#e5e7eb',
  bordFort: '#d1d5db',
  primaire: '#16a34a',
  primaireTexte: '#ffffff',
  primaireDoux: '#dcfce7',
  danger: '#dc2626',
  dangerDoux: '#fee2e2',
  avertissement: '#f59e0b',
  avertissementDoux: '#fffbeb',
  avertissementTexte: '#78350f',
  info: '#0284c7',
  moisFond: '#fff7ed',
  moisBord: '#fed7aa',
  moisMontant: '#9a3412',
  valideFond: '#ecfdf5',
  valideBord: '#6ee7b7',
  valideTexte: '#064e3b',
  valideFort: '#047857',
  referentFond: '#f5f3ff',
  referentBord: '#c4b5fd',
  referentTexte: '#4c1d95',
  annuleeFond: '#fee2e2',
  annuleeBord: '#f87171',
  annuleeBadge: '#dc2626',
  weekendFond: '#ecfdf5',
  weekendBord: '#a7f3d0',
  weekendTexte: '#064e3b',
  weekendIcone: '#059669',
  lien: '#0369a1',
  ombre: '#0f172a',
};

const sombre: Palette = {
  sombre: true,
  fond: '#0b1020',
  carte: '#141b2b',
  carte2: '#1b2336',
  texte: '#eef0f5',
  texteDoux: '#9aa3b5',
  bord: '#263048',
  bordFort: '#34405c',
  primaire: '#22c55e',
  primaireTexte: '#04130a',
  primaireDoux: 'rgba(34,197,94,0.15)',
  danger: '#f87171',
  dangerDoux: 'rgba(248,113,113,0.15)',
  avertissement: '#fbbf24',
  avertissementDoux: 'rgba(251,191,36,0.12)',
  avertissementTexte: '#fde68a',
  info: '#38bdf8',
  moisFond: '#2a1407',
  moisBord: '#7c2d12',
  moisMontant: '#fed7aa',
  valideFond: 'rgba(16,185,129,0.12)',
  valideBord: '#047857',
  valideTexte: '#a7f3d0',
  valideFort: '#6ee7b7',
  referentFond: 'rgba(139,92,246,0.14)',
  referentBord: '#6d28d9',
  referentTexte: '#ddd6fe',
  annuleeFond: 'rgba(220,38,38,0.18)',
  annuleeBord: '#991b1b',
  annuleeBadge: '#dc2626',
  weekendFond: 'rgba(16,185,129,0.12)',
  weekendBord: '#065f46',
  weekendTexte: '#d1fae5',
  weekendIcone: '#34d399',
  lien: '#7dd3fc',
  ombre: '#000000',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? sombre : clair;
}

export interface StyleStatut {
  libelle: string;
  court: string;
  point: string;
  fond: string;
  bord: string;
  texte: string;
}

const STATUTS_CLAIR: Record<Statut, StyleStatut> = {
  pending: { libelle: 'En attente', court: 'Attente', point: '#fbbf24', fond: '#fffbeb', bord: '#fde68a', texte: '#78350f' },
  available: { libelle: 'Disponible', court: 'Dispo', point: '#0ea5e9', fond: '#f0f9ff', bord: '#bae6fd', texte: '#0c4a6e' },
  unavailable: { libelle: 'Pas disponible', court: 'Pas dispo', point: '#94a3b8', fond: '#f1f5f9', bord: '#cbd5e1', texte: '#334155' },
  validated: { libelle: 'Validé', court: 'Validé', point: '#10b981', fond: '#ecfdf5', bord: '#6ee7b7', texte: '#064e3b' },
  teamLeader: { libelle: 'Référent', court: 'Réf.', point: '#8b5cf6', fond: '#f5f3ff', bord: '#c4b5fd', texte: '#4c1d95' },
  rejected: { libelle: 'Refusé', court: 'Refusé', point: '#f43f5e', fond: '#fff1f2', bord: '#fecdd3', texte: '#881337' },
  nonPris: { libelle: 'Non pris', court: 'Non pris', point: '#fb923c', fond: '#fff7ed', bord: '#fed7aa', texte: '#7c2d12' },
};

const STATUTS_SOMBRE: Record<Statut, StyleStatut> = {
  pending: { ...STATUTS_CLAIR.pending, fond: 'rgba(251,191,36,0.12)', bord: '#92400e', texte: '#fde68a' },
  available: { ...STATUTS_CLAIR.available, fond: 'rgba(14,165,233,0.12)', bord: '#075985', texte: '#bae6fd' },
  unavailable: { ...STATUTS_CLAIR.unavailable, fond: 'rgba(148,163,184,0.12)', bord: '#475569', texte: '#cbd5e1' },
  validated: { ...STATUTS_CLAIR.validated, fond: 'rgba(16,185,129,0.14)', bord: '#047857', texte: '#a7f3d0' },
  teamLeader: { ...STATUTS_CLAIR.teamLeader, fond: 'rgba(139,92,246,0.16)', bord: '#6d28d9', texte: '#ddd6fe' },
  rejected: { ...STATUTS_CLAIR.rejected, fond: 'rgba(244,63,94,0.14)', bord: '#9f1239', texte: '#fecdd3' },
  nonPris: { ...STATUTS_CLAIR.nonPris, fond: 'rgba(251,146,60,0.14)', bord: '#9a3412', texte: '#fed7aa' },
};

export function useStatuts(): Record<Statut, StyleStatut> {
  return useColorScheme() === 'dark' ? STATUTS_SOMBRE : STATUTS_CLAIR;
}

export const STATUTS_LIBELLES: Record<Statut, string> = Object.fromEntries(
  Object.entries(STATUTS_CLAIR).map(([k, v]) => [k, v.libelle]),
) as Record<Statut, string>;

export const rayon = { petit: 8, moyen: 12, grand: 16 };
