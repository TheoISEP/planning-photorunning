import type { Statut } from '@/lib/planning';

/** Formes JSON servies par l'API (voir lib/serialize.ts). */

export interface TarifJson {
  id: string;
  courseId: string;
  nom: string;
  ordre: number;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  nombreJours: number;
}

export interface CourseJson {
  id: string;
  nom: string;
  description: string;
  localisation: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  statutTraitement: 'inProgress' | 'done';
  doneAt: string;
  coureursAttendus: number;
  numberAttended: number;
  briefPdfUrl: string;
  visible: boolean;
  archived: boolean;
  archivedAt: string;
  hotel: string;
  transport: string;
  supplementaire: string;
  hotelValid: boolean;
  transportValid: boolean;
  hotelPrice: number | null;
  transportPrice: number | null;
  foodPrice: number | null;
  comOrga: number | null;
  twoPrices: boolean;
  tarifs: TarifJson[];
}

export interface DispoJson {
  id: string;
  courseId: string;
  photographeId: string;
  tarifId: string;
  statut: Statut;
  declaration: 'pending' | 'available' | 'unavailable';
  decision: 'validated' | 'teamLeader' | 'rejected' | 'nonPris' | null;
  published: boolean;
  noteAdmin: string;
}

export interface UserJson {
  id: string;
  email: string;
  role: 'admin' | 'photographer';
  nom: string;
  prenom: string;
  telephone: string;
  actif: boolean;
  region: string;
  nonRemunere: boolean;
  inCharge: boolean;
  chargeOne: string;
  chargeTwo: string;
  chargeThree: string;
  chargeFour: string;
  chargeFive: string;
}

export interface WeekendSummaryJson {
  key: string;
  label: string;
  photographers: number;
  events: number;
  courseIds: string[];
}

export const dispoKey = (courseId: string, userId: string, tarifId: string) => `${courseId}|${userId}|${tarifId}`;

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // corps non JSON
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
