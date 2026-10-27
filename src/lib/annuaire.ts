import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ANNUAIRE_DUREE_MAX_MS } from './config';
import { admin, CLE_CHIFFREMENT_ANNUAIRE, CLE_JETON_ANNUAIRE, ecrireSecret, effacerSecret, ErreurApi, lireSecret } from './api';
import { depuisHex, depuisUtf8, versHex, versUtf8 } from './octets';
import { ecrireJson, ecrireOctets, lireJson, lireOctets, supprimer } from './stockage';
import { lire, modifier, modifierAnnuaire } from './store';
import type { Annuaire } from './types';

/**
 * L'ANNUAIRE SUR LE TÉLÉPHONE DES ADMINS.
 *
 * Comptes de l'annuaire (pas ceux du planning), comme sur le web. La copie
 * hors ligne est chiffrée (XChaCha20-Poly1305) avec une clé aléatoire rangée
 * dans le trousseau du téléphone, jamais sauvegardée ni copiée ailleurs :
 * une sauvegarde iCloud ou une copie du fichier ne donne rien.
 *
 * L'onglet s'ouvre par Face ID / empreinte (ou le code du téléphone), se
 * reverrouille quand l'app passe en arrière-plan, et la copie est effacée si
 * le serveur refuse la session (compte désactivé, session supprimée) ou après
 * 14 jours sans synchro.
 */

const FICHIER = 'annuaire.bin';
let cle: Uint8Array | null = null;

function chiffrer(donnees: Annuaire, k: Uint8Array): Uint8Array {
  const nonce = Crypto.getRandomBytes(24);
  const scelle = xchacha20poly1305(k, nonce).encrypt(versUtf8(JSON.stringify(donnees)));
  const sortie = new Uint8Array(24 + scelle.length);
  sortie.set(nonce, 0);
  sortie.set(scelle, 24);
  return sortie;
}

function dechiffrer(octets: Uint8Array, k: Uint8Array): Annuaire {
  const nonce = octets.slice(0, 24);
  const clair = xchacha20poly1305(k, nonce).decrypt(octets.slice(24));
  return JSON.parse(depuisUtf8(clair)) as Annuaire;
}

async function cleDeChiffrement(creerSiAbsente: boolean): Promise<Uint8Array | null> {
  const hex = await lireSecret(CLE_CHIFFREMENT_ANNUAIRE);
  if (hex) return depuisHex(hex);
  if (!creerSiAbsente) return null;
  const nouvelle = Crypto.getRandomBytes(32);
  await ecrireSecret(CLE_CHIFFREMENT_ANNUAIRE, versHex(nouvelle));
  return nouvelle;
}

/** Connexion à l'annuaire avec SON compte (email + mot de passe de l'annuaire). */
export async function connecterAnnuaire(email: string, motDePasse: string) {
  const r = await admin<{ token: string; membre: Annuaire['membre'] }>('/api/annuaire/mobile/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password: motDePasse }),
  });
  await ecrireSecret(CLE_JETON_ANNUAIRE, r.token);
  cle = await cleDeChiffrement(true);
  modifierAnnuaire({ connecte: true, deverrouille: true, erreur: null });
  await sauverMeta();
  await synchroniserAnnuaire();
}

/** Face ID / empreinte / code du téléphone. */
export async function deverrouillerAnnuaire(): Promise<'ok' | 'annule' | 'indisponible'> {
  // NONE : ni biométrie ni code sur le téléphone. Sinon Face ID / empreinte,
  // avec repli sur le code du téléphone.
  const niveau = await LocalAuthentication.getEnrolledLevelAsync();
  if (niveau === LocalAuthentication.SecurityLevel.NONE) return 'indisponible';
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Ouvrir l’annuaire PhotoRunning',
    cancelLabel: 'Annuler',
    fallbackLabel: 'Code du téléphone',
  });
  if (!r.success) {
    return r.error === 'not_enrolled' || r.error === 'passcode_not_set' || r.error === 'not_available' ? 'indisponible' : 'annule';
  }
  await ouvrirCopie();
  return 'ok';
}

/** Sans Face ID ni code sur le téléphone : on redemande le mot de passe de l'annuaire. */
export async function deverrouillerParMotDePasse(email: string, motDePasse: string) {
  await connecterAnnuaire(email, motDePasse);
}

async function ouvrirCopie() {
  cle = await cleDeChiffrement(true);
  const octets = await lireOctets(FICHIER);
  let donnees: Annuaire | null = null;
  if (octets && cle) {
    try {
      donnees = dechiffrer(octets, cle);
    } catch {
      // Clé perdue (réinstallation, restauration sur un autre téléphone) : copie illisible, on la refait.
      supprimer(FICHIER);
    }
  }
  modifierAnnuaire({ deverrouille: true, donnees, erreur: null });
  void synchroniserAnnuaire();
}

/** Reverrouillage : la copie déchiffrée quitte la mémoire. */
export function verrouillerAnnuaire() {
  cle = null;
  modifierAnnuaire({ deverrouille: false, donnees: null });
}

export async function synchroniserAnnuaire() {
  const e = lire();
  if (!e.annuaire.deverrouille || e.annuaire.enCours || !cle) return;
  const jeton = await lireSecret(CLE_JETON_ANNUAIRE);
  if (!jeton) {
    await effacerAnnuaire();
    return;
  }
  modifierAnnuaire({ enCours: true, erreur: null });
  try {
    const donnees = await admin<Annuaire>('/api/annuaire/mobile/sync', { jeton, delaiMs: 40_000 });
    await ecrireOctets(FICHIER, chiffrer(donnees, cle));
    modifierAnnuaire({ donnees, derniere: new Date().toISOString(), enCours: false });
    await sauverMeta();
  } catch (err) {
    if (err instanceof ErreurApi && err.status === 401) {
      await effacerAnnuaire();
      modifier(() => ({
        avis: { titre: 'Annuaire fermé', texte: `${err.message} La copie de l’annuaire a été effacée de ce téléphone.` },
      }));
      return;
    }
    modifierAnnuaire({ enCours: false, erreur: err instanceof ErreurApi && err.horsLigne ? null : err instanceof Error ? err.message : 'Synchro impossible' });
  }
}

/** Copie trop ancienne (14 jours sans synchro) : effacée au démarrage. */
export async function verifierExpirationAnnuaire() {
  const d = lire().annuaire.derniere;
  if (d && Date.now() - new Date(d).getTime() > ANNUAIRE_DUREE_MAX_MS) await effacerAnnuaire();
}

export async function deconnecterAnnuaire() {
  const jeton = await lireSecret(CLE_JETON_ANNUAIRE);
  if (jeton) await admin('/api/annuaire/mobile/logout', { method: 'POST', jeton, delaiMs: 8000 }).catch(() => undefined);
  await effacerAnnuaire();
}

/** Efface tout ce qui touche l'annuaire sur ce téléphone (copie, jeton, clé). */
export async function effacerAnnuaire() {
  cle = null;
  supprimer(FICHIER);
  await effacerSecret(CLE_JETON_ANNUAIRE);
  await effacerSecret(CLE_CHIFFREMENT_ANNUAIRE);
  modifierAnnuaire({ connecte: false, deverrouille: false, donnees: null, derniere: null, enCours: false, erreur: null });
  await sauverMeta();
}

/** L'état « connecté / dernière synchro » de l'annuaire est gardé avec celui de l'app. */
async function sauverMeta() {
  const disque = (await lireJson<Record<string, unknown>>('etat.json')) ?? {};
  const a = lire().annuaire;
  await ecrireJson('etat.json', { ...disque, annuaireConnecte: a.connecte, annuaireDerniere: a.derniere });
}
