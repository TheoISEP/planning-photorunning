import { Directory, File, Paths } from 'expo-file-system';
import { depuisUtf8, versUtf8 } from './octets';

/**
 * Tout ce que l'app garde pour le hors ligne vit dans un dossier privé de
 * l'app (Documents/equipe), jamais dans le cache (le système peut le vider
 * quand il veut, justement quand on n'a pas de réseau) :
 *
 *   planning.json          la dernière synchro du planning
 *   briefs/<id>.json       chaque brief complet
 *   fichiers/<clé>         images, PDF, traces GPX des briefs
 *   annuaire.bin           l'annuaire des admins, chiffré (voir annuaire.ts)
 *   etat.json, file.json   état local et changements en attente d'envoi
 *
 * Les écritures passent par un fichier temporaire puis un renommage : une
 * coupure en pleine écriture ne laisse jamais un fichier à moitié écrit.
 */

const racine = () => new Directory(Paths.document, 'equipe');
const dossier = (...noms: string[]) => new Directory(racine(), ...noms);

function assurerDossier(d: Directory) {
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

export function preparerStockage() {
  assurerDossier(racine());
  assurerDossier(dossier('briefs'));
  assurerDossier(dossier('fichiers'));
}

function fichier(nom: string): File {
  return new File(racine(), nom);
}

async function ecrireAtomique(f: File, contenu: string | Uint8Array) {
  const tmp = new File(f.parentDirectory, `${f.name}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create({ intermediates: true });
  await tmp.write(contenu);
  if (f.exists) f.delete();
  tmp.move(f);
}

export async function lireJson<T>(nom: string): Promise<T | null> {
  try {
    const f = fichier(nom);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as T;
  } catch (err) {
    console.warn(`[stockage] lecture de ${nom} impossible`, err);
    return null;
  }
}

export async function ecrireJson(nom: string, donnees: unknown): Promise<void> {
  await ecrireAtomique(fichier(nom), JSON.stringify(donnees));
}

export async function lireOctets(nom: string): Promise<Uint8Array | null> {
  const f = fichier(nom);
  if (!f.exists) return null;
  return f.bytes();
}

export async function ecrireOctets(nom: string, octets: Uint8Array): Promise<void> {
  await ecrireAtomique(fichier(nom), octets);
}

export function supprimer(nom: string) {
  const f = fichier(nom);
  if (f.exists) f.delete();
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export const nomBrief = (id: string) => `briefs/${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`;

export function supprimerBrief(id: string) {
  supprimer(nomBrief(id));
}

export function briefsPresents(): Set<string> {
  const d = dossier('briefs');
  if (!d.exists) return new Set();
  return new Set(
    d
      .list()
      .filter((x): x is File => x instanceof File && x.name.endsWith('.json'))
      .map((f) => f.name.replace(/\.json$/, '')),
  );
}

// ---------------------------------------------------------------------------
// Fichiers des briefs (images, PDF, GPX), rangés par clé S3
// ---------------------------------------------------------------------------

/** Nom de fichier stable pour une clé S3 (elle ne change jamais pour un même fichier). */
export function nomDeCle(cle: string): string {
  const propre = cle.replace(/[^A-Za-z0-9._-]/g, '_');
  return propre.length > 180 ? `${propre.slice(0, 90)}__${propre.slice(-88)}` : propre;
}

export function fichierDeCle(cle: string): File {
  return new File(dossier('fichiers'), nomDeCle(cle));
}

export function uriLocale(cle: string | null | undefined): string | null {
  if (!cle) return null;
  const f = fichierDeCle(cle);
  return f.exists ? f.uri : null;
}

export async function telechargerCle(cle: string, url: string): Promise<boolean> {
  const f = fichierDeCle(cle);
  if (f.exists && f.size > 0) return true;
  try {
    const tmp = new File(dossier('fichiers'), `${nomDeCle(cle)}.part`);
    if (tmp.exists) tmp.delete();
    await File.downloadFileAsync(url, tmp, { idempotent: true });
    if (f.exists) f.delete();
    tmp.move(f);
    return true;
  } catch (err) {
    console.warn(`[stockage] téléchargement impossible : ${cle}`, err);
    return false;
  }
}

/** Efface les fichiers qu'aucun brief gardé ne référence plus. */
export function nettoyerFichiers(clesGardees: Set<string>): number {
  const d = dossier('fichiers');
  if (!d.exists) return 0;
  const garder = new Set([...clesGardees].map(nomDeCle));
  let n = 0;
  for (const x of d.list()) {
    if (x instanceof File && !garder.has(x.name) && !x.name.endsWith('.part')) {
      x.delete();
      n++;
    }
  }
  return n;
}

/** Place occupée par les données hors ligne, en octets. */
export function tailleStockage(): number {
  const d = racine();
  if (!d.exists) return 0;
  return d.size ?? 0;
}

/** Tout effacer (déconnexion, appareil révoqué). */
export function toutEffacer() {
  const d = racine();
  if (d.exists) d.delete();
  preparerStockage();
}

export { depuisUtf8, versUtf8 };
