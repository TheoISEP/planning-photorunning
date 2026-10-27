/**
 * Formes des données reçues du planning (POST /api/mobile/sync) et de
 * l'annuaire (GET /api/annuaire/mobile/sync). Elles reprennent celles du site
 * (components/planning/types.ts du planning) pour garder les mêmes règles.
 */

export type Declaration = 'pending' | 'available' | 'unavailable';
export type Decision = 'validated' | 'teamLeader' | 'rejected' | 'nonPris';
export type Statut = Declaration | Decision;
export type Role = 'admin' | 'photographer';

export interface Tarif {
  id: string;
  courseId: string;
  nom: string;
  ordre: number;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  nombreJours: number;
}

export interface Course {
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
  briefId: string;
  briefUrl: string;
  visible: boolean;
  archived: boolean;
  annulee: boolean;
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
  tarifs: Tarif[];
}

export interface Dispo {
  id: string;
  courseId: string;
  photographeId: string;
  tarifId: string;
  statut: Statut;
  declaration: Declaration;
  decision: Decision | null;
  published: boolean;
  noteAdmin: string;
}

export interface Personne {
  id: string;
  role: Role;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  region: string;
  actif: boolean;
  inCharge: boolean;
  nonRemunere: boolean;
}

export interface Moi extends Personne {
  /** Photographes à charge (référent) */
  geres: string[];
}

export interface WeekendResume {
  key: string;
  label: string;
  photographers: number;
  events: number;
  courseIds: string[];
}

export interface Coequipier {
  prenom: string;
  nom: string;
  referent: boolean;
  telephone: string;
}

export interface BriefIndex {
  id: string;
  title: string;
  year: number;
  eventDate: string | null;
  updatedAt: string;
  folderName: string | null;
  status: string;
  shareToken: string | null;
  shareUrl: string | null;
  courseIds: string[];
}

export interface ContactEquipe {
  id: string;
  prenom: string;
  nom: string;
  poste: string;
  organisation: string;
  aSavoir: string;
  telephones: { numero: string; libelle: string; whatsapp: boolean }[];
  emails: { adresse: string; libelle: string }[];
}

export interface ConfigApp {
  latestVersion: string;
  minVersion: string;
  message: string;
  iosUrl: string;
  androidUrl: string;
}

export interface Synchro {
  serverTime: string;
  me: Moi;
  personnes: Personne[];
  courses: Course[];
  dispos: Dispo[];
  weekends: Record<string, WeekendResume>;
  equipes: Record<string, Coequipier[]>;
  /** null : l'app des briefs était injoignable, on garde l'index d'avant */
  briefs: BriefIndex[] | null;
  /** null : l'annuaire était injoignable, on garde les contacts d'avant */
  contacts: ContactEquipe[] | null;
  config: ConfigApp;
}

/** Un brief complet, tel que gardé sur le téléphone. */
export interface Asset {
  key: string;
  url: string | null;
}

export interface BriefComplet {
  id: string;
  title: string;
  year: number;
  eventDate: string | null;
  updatedAt: string;
  status: string;
  theme: unknown;
  folder: { name: string; logoKey: string | null; logoUrl: string | null } | null;
  photorunningLogo: Asset | null;
  photographers: { id: string; firstName: string; lastName: string; positionLabel: string | null }[];
  sections: Section[];
  assets: Asset[];
  shareToken: string | null;
  shareUrl: string | null;
  courseIds: string[];
  /** Ouvert depuis un lien de partage (pas dans la liste de la personne) */
  parLien?: boolean;
}

/** Les sections du brief (src/lib/schemas/sections.ts de l'app des briefs), lues avec indulgence. */
export interface Section {
  id: string;
  type: string;
  customTitle?: string;
  data: any;
}

// ---------------------------------------------------------------------------
// Annuaire (admins)
// ---------------------------------------------------------------------------

export interface Canal {
  type: string;
  valeur: string;
  libelle: string | null;
  principal: boolean;
}

export interface Thematique {
  id: string;
  nom: string;
  couleur: string;
  parentId: string | null;
  ordre: number;
}

export interface Organisation {
  id: string;
  nom: string;
  thematiqueId: string | null;
  description: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  tags: string[];
  canaux: Canal[];
}

export interface ContactAnnuaire {
  id: string;
  prenom: string;
  nom: string;
  organisationId: string | null;
  poste: string | null;
  secteur: string | null;
  importance: number;
  ville: string | null;
  pays: string | null;
  langue: string | null;
  aSavoir: string | null;
  tags: string[];
  visiblePhotographes: boolean;
  thematiqueIds: string[];
  canaux: Canal[];
  notes: { type: string; contenu: string; date: string; auteurNom: string }[];
}

export interface Annuaire {
  serverTime: string;
  membre: { id: string; name: string; role: 'ADMIN' | 'MEMBRE' };
  thematiques: Thematique[];
  organisations: Organisation[];
  contacts: ContactAnnuaire[];
  favoris: string[];
}
