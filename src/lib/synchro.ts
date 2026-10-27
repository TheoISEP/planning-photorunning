import * as Crypto from 'expo-crypto';
import { ADMIN_FENETRE_FICHIERS, SYNCHRO_INTERVALLE_MIN_MS } from './config';
import { CLE_JETON_PLANNING, ErreurApi, effacerSecret, ecrireSecret, lireSecret, planning as apiPlanning } from './api';
import { infosAppareil, versionInstallee } from './appareil';
import { appliquerStatut, estDeclaration } from './planning';
import {
  briefsPresents,
  ecrireJson,
  lireJson,
  nettoyerFichiers,
  nomBrief,
  preparerStockage,
  supprimerBrief,
  telechargerCle,
  toutEffacer,
  uriLocale,
} from './stockage';
import { lire, modifier, modifierSynchro, type BriefLocal, type EtatApp, type OperationEnAttente, type Utilisateur } from './store';
import type { BriefComplet, BriefIndex, ConfigApp, Course, Dispo, Statut, Synchro } from './types';
import { etatDeVersion } from './versions';
import { effacerAnnuaire, verifierExpirationAnnuaire } from './annuaire';

/**
 * LA SYNCHRO — ce qui rend l'app utilisable sans réseau.
 *
 * À chaque ouverture (et au retour du réseau), si on est connecté :
 *  1. les changements faits hors ligne partent (disponibilités) ;
 *  2. le planning est rechargé en entier depuis le planning (jecourse.fr) ;
 *  3. les briefs qui ont changé sont rechargés, et leurs fichiers (images,
 *     PDF, traces) téléchargés : tous chez un photographe, ceux des courses
 *     proches (ou épinglés) chez un admin ;
 *  4. ce qui n'est plus utile est effacé.
 * Une source injoignable ne vide jamais ce qu'on a déjà.
 */

let jeton: string | null = null;
let derniereTentative = 0;

interface EtatDisque {
  utilisateur: Utilisateur | null;
  derniere: string | null;
  config: ConfigApp | null;
  briefsLocaux: Record<string, BriefLocal>;
  briefsParLien: Record<string, BriefIndex>;
  personneActive: string | null;
  annuaireDerniere: string | null;
  annuaireConnecte: boolean;
}

async function sauverEtat() {
  const e = lire();
  const disque: EtatDisque = {
    utilisateur: e.utilisateur,
    derniere: e.synchro.derniere,
    config: e.config,
    briefsLocaux: e.briefsLocaux,
    briefsParLien: e.briefsParLien,
    personneActive: e.personneActive,
    annuaireDerniere: e.annuaire.derniere,
    annuaireConnecte: e.annuaire.connecte,
  };
  await ecrireJson('etat.json', disque);
}

export const sauverEtatLocal = sauverEtat;

async function sauverFile() {
  await ecrireJson('file.json', lire().file);
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

export async function demarrer() {
  preparerStockage();
  const [disque, planning, file] = await Promise.all([
    lireJson<EtatDisque>('etat.json'),
    lireJson<Synchro>('planning.json'),
    lireJson<OperationEnAttente[]>('file.json'),
  ]);
  jeton = await lireSecret(CLE_JETON_PLANNING);
  const utilisateur = jeton ? disque?.utilisateur ?? null : null;
  modifier((e) => ({
    charge: true,
    utilisateur,
    planning: utilisateur ? planning : null,
    file: utilisateur ? file ?? [] : [],
    config: disque?.config ?? planning?.config ?? null,
    briefsLocaux: utilisateur ? disque?.briefsLocaux ?? {} : {},
    briefsParLien: utilisateur ? disque?.briefsParLien ?? {} : {},
    personneActive: disque?.personneActive ?? null,
    synchro: { ...e.synchro, derniere: utilisateur ? disque?.derniere ?? null : null },
    annuaire: { ...e.annuaire, connecte: !!disque?.annuaireConnecte, derniere: disque?.annuaireDerniere ?? null },
  }));
  await verifierExpirationAnnuaire();
  void rafraichirConfig();
  if (utilisateur) void synchroniser({ force: true });
}

/** Réglage des versions, lisible sans compte (écran « mets à jour »). */
export async function rafraichirConfig() {
  try {
    const config = await apiPlanning<ConfigApp>('/api/mobile/config', { delaiMs: 10_000 });
    modifier(() => ({ config }));
    await sauverEtat();
  } catch {
    // hors ligne : on garde le dernier réglage connu
  }
}

export function versionBloquee(e: EtatApp = lire()): boolean {
  return etatDeVersion(versionInstallee(), e.config) === 'obligatoire';
}

// ---------------------------------------------------------------------------
// Connexion / déconnexion
// ---------------------------------------------------------------------------

export async function connecter(email: string, motDePasse: string) {
  const r = await apiPlanning<{ token: string; deviceId: string; user: Utilisateur }>('/api/mobile/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password: motDePasse, device: infosAppareil() }),
  });
  // Un autre compte se connecte sur ce téléphone : rien de l'ancien ne reste.
  const avant = lire().utilisateur;
  if (avant && avant.id !== r.user.id) {
    toutEffacer();
    await effacerAnnuaire();
  }
  jeton = r.token;
  await ecrireSecret(CLE_JETON_PLANNING, r.token);
  modifier(() => ({ utilisateur: r.user, avis: null, lectureSeule: false }));
  await sauverEtat();
  await synchroniser({ force: true });
}

/** Déconnexion volontaire : le jeton est révoqué côté serveur, tout est effacé ici. */
export async function deconnecter() {
  const j = jeton;
  if (j) {
    await apiPlanning('/api/mobile/logout', { method: 'POST', jeton: j, delaiMs: 8000 }).catch(() => undefined);
  }
  await toutOublier(null);
}

/** L'appareil n'est plus accepté (déconnecté par un admin, compte désactivé). */
async function deconnexionForcee(raison: string) {
  await toutOublier({ titre: 'Tu as été déconnecté', texte: `${raison} Les données gardées sur ce téléphone ont été effacées.` });
}

async function toutOublier(avis: EtatApp['avis']) {
  generation++;
  jeton = null;
  await effacerSecret(CLE_JETON_PLANNING);
  await effacerAnnuaire();
  toutEffacer();
  modifier((e) => ({
    utilisateur: null,
    planning: null,
    file: [],
    briefsLocaux: {},
    briefsParLien: {},
    personneActive: null,
    lectureSeule: false,
    synchro: { enCours: false, etape: null, derniere: null, erreur: null },
    avis,
    config: e.config,
  }));
  await sauverEtat();
}

// ---------------------------------------------------------------------------
// Synchro
// ---------------------------------------------------------------------------

/**
 * Génération de session : toute déconnexion l'incrémente. Une synchro ou un
 * envoi lancé avant s'arrête au premier retour du réseau, pour ne jamais
 * réécrire sur le téléphone ce qu'on vient d'effacer.
 */
let generation = 0;
class Abandon extends Error {}
const verifier = (g: number) => {
  if (g !== generation) throw new Abandon('session changée');
};

/** Téléchargements de fichiers en cours : le ménage des fichiers attend qu'ils finissent. */
let telechargementsEnCours = 0;

/** Les adresses signées des fichiers valent 6 h : au-delà de 5 h, on recharge le brief avant de télécharger. */
const URL_VALIDE_MS = 5 * 3600_000;
/** Un brief ouvert par un lien reste 60 jours après sa course (ou son ouverture s'il n'a pas de date). */
const GARDE_LIEN_MS = 60 * 86_400_000;

function majBriefLocal(id: string, patch: Partial<BriefLocal> | null) {
  modifier((e) => {
    const l = { ...e.briefsLocaux };
    if (patch === null) delete l[id];
    else l[id] = { ...(l[id] ?? { updatedAt: '', fichiers: 'aucun' }), ...patch };
    return { briefsLocaux: l };
  });
}

export async function synchroniser(options: { force?: boolean } = {}) {
  const e = lire();
  if (!jeton || !e.utilisateur || e.synchro.enCours) return;
  if (versionBloquee(e)) return;
  if (!options.force && Date.now() - derniereTentative < SYNCHRO_INTERVALLE_MIN_MS) return;
  derniereTentative = Date.now();
  const g = generation;
  modifierSynchro({ enCours: true, etape: 'Planning', erreur: null });
  try {
    await envoyerFile();
    verifier(g);
    const s = await apiPlanning<Synchro>('/api/mobile/sync', {
      method: 'POST',
      jeton,
      body: JSON.stringify({ device: infosAppareil() }),
      delaiMs: 40_000,
    });
    verifier(g);
    const avant = lire().planning;
    const fusion: Synchro = {
      ...s,
      briefs: s.briefs ?? avant?.briefs ?? [],
      contacts: s.contacts ?? avant?.contacts ?? [],
    };
    // Les changements encore en file restent appliqués par-dessus le serveur.
    fusion.dispos = appliquerFile(fusion.dispos, lire().file, fusion.courses);
    await ecrireJson('planning.json', fusion);
    verifier(g);
    modifier(() => ({
      planning: fusion,
      config: s.config,
      utilisateur: { id: s.me.id, email: s.me.email, role: s.me.role, prenom: s.me.prenom, nom: s.me.nom },
      enLigne: true,
    }));
    await sauverEtat();

    modifierSynchro({ etape: 'Briefs' });
    await synchroniserBriefs(fusion, g);
    verifier(g);

    modifierSynchro({ enCours: false, etape: null, derniere: new Date().toISOString(), erreur: null });
    await sauverEtat();
  } catch (err) {
    if (err instanceof Abandon || g !== generation) return;
    if (err instanceof ErreurApi && err.appareilRefuse) {
      modifierSynchro({ enCours: false, etape: null });
      await deconnexionForcee(err.message);
      return;
    }
    const horsLigne = err instanceof ErreurApi && err.horsLigne;
    modifier(() => ({ enLigne: !horsLigne }));
    modifierSynchro({
      enCours: false,
      etape: null,
      erreur: horsLigne ? null : err instanceof Error ? err.message : 'Synchronisation impossible',
    });
  }
}

/** Faut-il avoir les fichiers de ce brief sur le téléphone ? */
function fichiersVoulus(b: BriefIndex, role: 'admin' | 'photographer', local?: BriefLocal): boolean {
  if (role === 'photographer') return true;
  if (local?.epingle) return true;
  if (!b.eventDate) return false;
  const jours = (new Date(b.eventDate).getTime() - Date.now()) / 86_400_000;
  return jours >= -ADMIN_FENETRE_FICHIERS.avant && jours <= ADMIN_FENETRE_FICHIERS.apres;
}

/** Charge des briefs complets (10 par appel) et les range sur le téléphone. */
async function chargerBriefs(ids: string[], g: number, libelle: string) {
  for (let i = 0; i < ids.length; i += 10) {
    const lot = ids.slice(i, i + 10);
    modifierSynchro({ etape: `${libelle} ${Math.min(i + 10, ids.length)}/${ids.length}` });
    const r = await apiPlanning<{ briefs: BriefComplet[] }>('/api/mobile/briefs', {
      method: 'POST',
      jeton,
      body: JSON.stringify({ ids: lot }),
      delaiMs: 45_000,
    });
    verifier(g);
    for (const b of r.briefs) {
      await ecrireJson(nomBrief(b.id), b);
      verifier(g);
      const avant = lire().briefsLocaux[b.id];
      // Même version (simple rafraîchissement des adresses) : l'état des fichiers reste.
      const fichiers = avant && avant.updatedAt === b.updatedAt ? avant.fichiers : 'aucun';
      majBriefLocal(b.id, { updatedAt: b.updatedAt, fichiers, chargeLe: new Date().toISOString() });
    }
  }
}

function gardeParLien(b: BriefIndex, local?: BriefLocal): boolean {
  const reference = b.eventDate ? Date.parse(b.eventDate) : local?.chargeLe ? Date.parse(local.chargeLe) : 0;
  return !!reference && reference > Date.now() - GARDE_LIEN_MS;
}

async function synchroniserBriefs(s: Synchro, g: number) {
  const role = s.me.role;
  const index = s.briefs ?? [];
  const presents = briefsPresents();
  const nomCourt = (id: string) => nomBrief(id).replace(/^briefs\//, '').replace(/\.json$/, '');

  // 1. Briefs nouveaux ou modifiés
  const aCharger = index.filter((b) => {
    const l = lire().briefsLocaux[b.id];
    return !l || l.updatedAt !== b.updatedAt || !presents.has(nomCourt(b.id));
  });
  await chargerBriefs(
    aCharger.map((b) => b.id),
    g,
    'Briefs',
  );

  // 2. Fichiers des briefs voulus hors ligne ; adresses rechargées si elles ont plus de 5 h
  const voulus = index.filter((b) => fichiersVoulus(b, role, lire().briefsLocaux[b.id]) && lire().briefsLocaux[b.id]?.fichiers !== 'complets');
  const perimes = voulus.filter((b) => {
    const l = lire().briefsLocaux[b.id];
    return !l?.chargeLe || Date.now() - Date.parse(l.chargeLe) > URL_VALIDE_MS;
  });
  await chargerBriefs(
    perimes.map((b) => b.id),
    g,
    'Liens des fichiers',
  );
  for (const [n, b] of voulus.entries()) {
    modifierSynchro({ etape: `Fichiers des briefs ${n + 1}/${voulus.length}` });
    const etat = await telechargerFichiersDuBrief(b.id);
    verifier(g);
    if (lire().briefsLocaux[b.id]) majBriefLocal(b.id, { fichiers: etat });
  }

  // 3. Ménage, sur l'état ACTUEL : briefs qui ne sont plus pour nous (sauf ceux ouverts par lien)
  const e = lire();
  const garder = new Set(index.map((b) => b.id));
  for (const [id, b] of Object.entries(e.briefsParLien)) if (gardeParLien(b, e.briefsLocaux[id])) garder.add(id);
  for (const id of Object.keys(e.briefsLocaux)) {
    if (!garder.has(id)) {
      supprimerBrief(id);
      majBriefLocal(id, null);
    }
  }
  modifier((x) => ({ briefsParLien: Object.fromEntries(Object.entries(x.briefsParLien).filter(([id]) => garder.has(id) || !x.briefsLocaux[id])) }));
  await sauverEtat();
  await nettoyerFichiersInutiles();
}

/** Efface les fichiers qu'aucun brief gardé ne référence plus (jamais pendant un téléchargement). */
async function nettoyerFichiersInutiles() {
  if (telechargementsEnCours > 0) return;
  const e = lire();
  const cles = new Set<string>();
  for (const [id, l] of Object.entries(e.briefsLocaux)) {
    if (l.fichiers === 'aucun') continue;
    const b = await lireJson<BriefComplet>(nomBrief(id));
    for (const a of b?.assets ?? []) cles.add(a.key);
  }
  if (telechargementsEnCours > 0) return;
  nettoyerFichiers(cles);
}

/** Télécharge ce qui manque des fichiers d'un brief (4 à la fois). */
async function telechargerFichiersDuBrief(id: string): Promise<BriefLocal['fichiers']> {
  telechargementsEnCours++;
  try {
    const b = await lireJson<BriefComplet>(nomBrief(id));
    if (!b) return 'aucun';
    const manquants = b.assets.filter((a) => a.url && !uriLocale(a.key));
    let echecs = 0;
    for (let i = 0; i < manquants.length; i += 4) {
      const r = await Promise.all(manquants.slice(i, i + 4).map((a) => telechargerCle(a.key, a.url as string)));
      echecs += r.filter((ok) => !ok).length;
    }
    const sansUrl = b.assets.filter((a) => !a.url && !uriLocale(a.key)).length;
    return echecs + sansUrl === 0 ? 'complets' : 'partiels';
  } finally {
    telechargementsEnCours--;
  }
}

/**
 * Rendre un brief disponible hors ligne tout de suite (admin, ou fichiers
 * incomplets) : on le recharge (adresses fraîches) et on télécharge tout.
 */
export async function preparerBriefHorsLigne(id: string, epingler = false) {
  if (!jeton) return;
  const g = generation;
  const r = await apiPlanning<{ briefs: BriefComplet[] }>('/api/mobile/briefs', {
    method: 'POST',
    jeton,
    body: JSON.stringify({ ids: [id] }),
  });
  verifier(g);
  const b = r.briefs[0];
  if (!b) throw new Error('Brief introuvable.');
  await ecrireJson(nomBrief(b.id), b);
  const fichiers = await telechargerFichiersDuBrief(b.id);
  verifier(g);
  modifier((e) => ({
    briefsLocaux: {
      ...e.briefsLocaux,
      [b.id]: { updatedAt: b.updatedAt, fichiers, chargeLe: new Date().toISOString(), epingle: epingler || e.briefsLocaux[b.id]?.epingle },
    },
  }));
  await sauverEtat();
}

export async function desepinglerBrief(id: string) {
  modifier((e) => (e.briefsLocaux[id] ? { briefsLocaux: { ...e.briefsLocaux, [id]: { ...e.briefsLocaux[id], epingle: false } } } : {}));
  await sauverEtat();
}

export async function lireBrief(id: string): Promise<BriefComplet | null> {
  return lireJson<BriefComplet>(nomBrief(id));
}

/** Un lien de partage ouvert dans l'app : le brief est chargé et gardé à part. */
export async function ouvrirLienDePartage(token: string): Promise<string> {
  if (!jeton) throw new Error('Connecte-toi pour ouvrir ce brief.');
  const g = generation;
  const r = await apiPlanning<{ brief: BriefComplet }>('/api/mobile/lien', {
    method: 'POST',
    jeton,
    body: JSON.stringify({ token }),
  });
  verifier(g);
  const b = r.brief;
  await ecrireJson(nomBrief(b.id), b);
  const fichiers = await telechargerFichiersDuBrief(b.id);
  verifier(g);
  const index: BriefIndex = {
    id: b.id,
    title: b.title,
    year: b.year,
    eventDate: b.eventDate,
    updatedAt: b.updatedAt,
    folderName: b.folder?.name ?? null,
    status: b.status,
    shareToken: b.shareToken,
    shareUrl: b.shareUrl,
    courseIds: [],
  };
  modifier((e) => ({
    briefsParLien: { ...e.briefsParLien, [b.id]: index },
    briefsLocaux: { ...e.briefsLocaux, [b.id]: { updatedAt: b.updatedAt, fichiers, chargeLe: new Date().toISOString(), epingle: true } },
  }));
  await sauverEtat();
  return b.id;
}

/** Lien de partage d'un brief (admin), créé s'il n'existe pas. */
export async function lienDePartage(briefId: string): Promise<string> {
  if (!jeton) throw new Error('Connexion requise.');
  const r = await apiPlanning<{ token: string; url: string | null }>('/api/mobile/partage', {
    method: 'POST',
    jeton,
    body: JSON.stringify({ briefId }),
  });
  if (!r.url) throw new Error('Adresse de partage indisponible.');
  return r.url;
}

// ---------------------------------------------------------------------------
// Disponibilités : changements tout de suite à l'écran, envoyés dès que possible
// ---------------------------------------------------------------------------

function appliquerFile(dispos: Dispo[], file: OperationEnAttente[], courses: Course[]): Dispo[] {
  if (file.length === 0) return dispos;
  const parCle = new Map(dispos.map((d) => [`${d.courseId}|${d.photographeId}|${d.tarifId}`, d]));
  for (const op of file) {
    const cle = `${op.courseId}|${op.photographeId}|${op.tarifId}`;
    const avant = parCle.get(cle);
    const course = courses.find((c) => c.id === op.courseId);
    if (!course) continue;
    const base: Dispo = avant ?? {
      id: cle,
      courseId: op.courseId,
      photographeId: op.photographeId,
      tarifId: op.tarifId,
      statut: 'pending',
      declaration: 'pending',
      decision: null,
      published: false,
      noteAdmin: '',
    };
    const etats = appliquerStatut(base, op.statut);
    parCle.set(cle, { ...base, ...etats, statut: op.statut });
  }
  return [...parCle.values()];
}

export async function changerStatut(courseId: string, photographeId: string, tarifId: string, statut: Statut) {
  const e = lire();
  if (!e.planning || e.lectureSeule) return;
  if (e.utilisateur?.role !== 'admin' && !estDeclaration(statut)) return;
  const op: OperationEnAttente = {
    id: Crypto.randomUUID(),
    courseId,
    photographeId,
    tarifId,
    statut,
    creeLe: new Date().toISOString(),
  };
  // Une seule opération en attente par case : la dernière choisie gagne.
  const file = [...e.file.filter((o) => !(o.courseId === courseId && o.photographeId === photographeId && o.tarifId === tarifId)), op];
  const dispos = appliquerFile(e.planning.dispos, [op], e.planning.courses);
  modifier(() => ({ file, planning: { ...e.planning!, dispos } }));
  await sauverFile();
  await ecrireJson('planning.json', lire().planning);
  void envoyerFile();
}

let envoiEnCours = false;

/**
 * Envoie les changements en attente, dans l'ordre, jusqu'à vider la file (un
 * changement fait pendant l'envoi part dans la foulée). Un changement n'est
 * abandonné que si le serveur le REFUSE (4xx : course finalisée entre-temps…) ;
 * sans réseau, en erreur serveur ou en trop-plein, il reste en file.
 */
export async function envoyerFile() {
  if (envoiEnCours || !jeton) return;
  envoiEnCours = true;
  const g = generation;
  const refus: string[] = [];
  let sessionARevoir = false;
  try {
    const tentes = new Set<string>();
    for (;;) {
      const op = lire().file.find((o) => !tentes.has(o.id));
      if (!op) break;
      tentes.add(op.id);
      try {
        const r = await apiPlanning<{ disponibilite: Dispo }>('/api/disponibilites', {
          method: 'PATCH',
          jeton,
          body: JSON.stringify({ courseId: op.courseId, photographeId: op.photographeId, tarifId: op.tarifId, statut: op.statut }),
          delaiMs: 15_000,
        });
        if (g !== generation) return;
        modifier((e) => {
          const reste = e.file.filter((o) => o.id !== op.id);
          if (!e.planning) return { file: reste };
          const autre = reste.some((o) => o.courseId === op.courseId && o.photographeId === op.photographeId && o.tarifId === op.tarifId);
          const dispos = autre
            ? e.planning.dispos
            : [
                ...e.planning.dispos.filter(
                  (d) => !(d.courseId === op.courseId && d.photographeId === op.photographeId && d.tarifId === op.tarifId),
                ),
                r.disponibilite,
              ];
          return { file: reste, planning: { ...e.planning, dispos }, enLigne: true };
        });
      } catch (err) {
        if (g !== generation) return;
        if (!(err instanceof ErreurApi)) break;
        if (err.horsLigne) {
          modifier(() => ({ enLigne: false }));
          break;
        }
        if (err.appareilRefuse) throw err;
        if (err.status === 401) {
          // Session à vérifier : la synchro saura si l'appareil a été déconnecté.
          sessionARevoir = true;
          break;
        }
        if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
          const course = lire().planning?.courses.find((c) => c.id === op.courseId);
          refus.push(`${course?.nom ?? 'Une course'} : ${err.message}`);
          modifier((e) => ({ file: e.file.filter((o) => o.id !== op.id) }));
          continue;
        }
        break;
      }
    }
  } catch (err) {
    if (err instanceof ErreurApi && err.appareilRefuse && g === generation) {
      envoiEnCours = false;
      await deconnexionForcee(err.message);
      return;
    }
  } finally {
    envoiEnCours = false;
  }
  if (g !== generation) return;
  await sauverFile();
  if (lire().planning) await ecrireJson('planning.json', lire().planning);
  if (refus.length) {
    modifier(() => ({
      avis: {
        titre: refus.length > 1 ? 'Changements non pris en compte' : 'Changement non pris en compte',
        texte: `${refus.join('\n')}\n\nLe planning a été remis à jour.`,
      },
    }));
  }
  if (refus.length || sessionARevoir) void synchroniser({ force: true });
}

/** Admin : passer une course en « Fait » (publie les décisions) ou la rouvrir. En ligne seulement. */
export async function changerEtatCourse(courseId: string, statutTraitement: 'done' | 'inProgress') {
  if (!jeton) throw new Error('Connexion requise.');
  await envoyerFile();
  try {
    await apiPlanning(`/api/courses/${courseId}`, {
      method: 'PATCH',
      jeton,
      body: JSON.stringify({ statutTraitement }),
    });
  } catch (err) {
    // 401 : la synchro dira si l'appareil a été déconnecté (et effacera tout).
    if (err instanceof ErreurApi && err.status === 401) void synchroniser({ force: true });
    throw err;
  }
  await synchroniser({ force: true });
}

export function choisirPersonne(id: string | null) {
  modifier(() => ({ personneActive: id }));
  void sauverEtat();
}

export function marquerHorsLigne(horsLigne: boolean) {
  modifier(() => ({ enLigne: !horsLigne }));
}

export function fermerAvis() {
  modifier(() => ({ avis: null }));
}

export function passerEnLectureSeule() {
  modifier(() => ({ lectureSeule: true }));
}

/** Pour l'écran Réglages : synchro forcée à la main. */
export const synchroniserMaintenant = () => synchroniser({ force: true });
