import { useSyncExternalStore } from 'react';
import type { Annuaire, BriefIndex, ConfigApp, Statut, Synchro } from './types';

/**
 * L'état de l'app, en un seul endroit. Les écrans s'y abonnent avec
 * useEtat(sélecteur) ; la logique (synchro, connexion, annuaire) le modifie
 * avec modifier(). Les sélecteurs doivent rendre des valeurs stables (un
 * champ de l'état, pas un objet recréé à chaque appel).
 */

export interface Utilisateur {
  id: string;
  email: string;
  role: 'admin' | 'photographer';
  prenom: string;
  nom: string;
}

export interface OperationEnAttente {
  id: string;
  courseId: string;
  photographeId: string;
  tarifId: string;
  statut: Statut;
  creeLe: string;
}

export interface BriefLocal {
  updatedAt: string;
  /** Tous les fichiers (images, PDF, traces) sont sur le téléphone */
  fichiers: 'complets' | 'partiels' | 'aucun';
  /** Gardé hors ligne à la demande (admins), même loin de sa date */
  epingle?: boolean;
  /** Quand le brief a été chargé (ses adresses de fichiers valent 6 h) */
  chargeLe?: string;
}

export interface EtatApp {
  charge: boolean;
  utilisateur: Utilisateur | null;
  planning: Synchro | null;
  briefsLocaux: Record<string, BriefLocal>;
  /** Briefs ouverts par un lien de partage, gardés à part */
  briefsParLien: Record<string, BriefIndex>;
  file: OperationEnAttente[];
  synchro: { enCours: boolean; etape: string | null; derniere: string | null; erreur: string | null };
  enLigne: boolean;
  config: ConfigApp | null;
  /** L'utilisateur a choisi de consulter ses données malgré une version trop ancienne */
  lectureSeule: boolean;
  /** Photographe à charge affiché (référent), null = soi-même */
  personneActive: string | null;
  annuaire: {
    connecte: boolean;
    deverrouille: boolean;
    donnees: Annuaire | null;
    derniere: string | null;
    enCours: boolean;
    erreur: string | null;
  };
  /** Message à afficher une fois (déconnexion à distance, refus d'un changement…) */
  avis: { titre: string; texte: string } | null;
}

export const ETAT_INITIAL: EtatApp = {
  charge: false,
  utilisateur: null,
  planning: null,
  briefsLocaux: {},
  briefsParLien: {},
  file: [],
  synchro: { enCours: false, etape: null, derniere: null, erreur: null },
  enLigne: true,
  config: null,
  lectureSeule: false,
  personneActive: null,
  annuaire: { connecte: false, deverrouille: false, donnees: null, derniere: null, enCours: false, erreur: null },
  avis: null,
};

let etat: EtatApp = ETAT_INITIAL;
const auditeurs = new Set<() => void>();

export const lire = () => etat;

export function modifier(f: (e: EtatApp) => Partial<EtatApp>) {
  etat = { ...etat, ...f(etat) };
  for (const a of auditeurs) a();
}

export function modifierAnnuaire(patch: Partial<EtatApp['annuaire']>) {
  modifier((e) => ({ annuaire: { ...e.annuaire, ...patch } }));
}

export function modifierSynchro(patch: Partial<EtatApp['synchro']>) {
  modifier((e) => ({ synchro: { ...e.synchro, ...patch } }));
}

function abonner(a: () => void) {
  auditeurs.add(a);
  return () => auditeurs.delete(a);
}

export function useEtat<T>(selecteur: (e: EtatApp) => T): T {
  return useSyncExternalStore(abonner, () => selecteur(etat), () => selecteur(etat));
}
