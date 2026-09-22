import type { Statut } from '@/lib/planning';

export type { Statut };

export interface StatutMeta {
  label: string;
  short: string;
  dot: string;
  chip: string;
  row: string;
}

/** Libellés et couleurs des statuts, partagés admin / photographe. */
export const STATUT_META: Record<Statut, StatutMeta> = {
  pending: {
    label: 'En attente',
    short: 'Attente',
    dot: 'bg-amber-400',
    chip: 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100',
    row: '',
  },
  available: {
    label: 'Disponible',
    short: 'Dispo',
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100',
    row: '',
  },
  unavailable: {
    label: 'Pas disponible',
    short: 'Pas dispo',
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200',
    row: '',
  },
  validated: {
    label: 'Validé',
    short: 'Validé',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100',
    row: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  },
  teamLeader: {
    label: 'Référent',
    short: 'Réf.',
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100',
    row: 'bg-violet-50/60 dark:bg-violet-950/20',
  },
  rejected: {
    label: 'Refusé',
    short: 'Refusé',
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100',
    row: '',
  },
  nonPris: {
    label: 'Non pris',
    short: 'Non pris',
    dot: 'bg-orange-400',
    chip: 'bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100',
    row: '',
  },
};

export const DECLARATION_OPTIONS: Statut[] = ['pending', 'available', 'unavailable'];
export const DECISION_OPTIONS: Statut[] = ['validated', 'teamLeader', 'rejected', 'nonPris'];
export const ALL_OPTIONS: Statut[] = [...DECLARATION_OPTIONS, ...DECISION_OPTIONS];

export const isWorkingStatut = (s: string | null | undefined) => s === 'validated' || s === 'teamLeader';

export const formatEuros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
