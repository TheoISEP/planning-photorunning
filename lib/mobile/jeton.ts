import { createHash, randomBytes } from 'node:crypto';

/**
 * Jetons de l'app mobile. Le téléphone garde le jeton dans son trousseau
 * (Keychain / Keystore) ; la base n'en garde que l'empreinte SHA-256, donc
 * une fuite de la base ne donne accès à aucun téléphone.
 */

export const PREFIXE_JETON = 'prm_';

export function nouveauJeton(): string {
  return PREFIXE_JETON + randomBytes(32).toString('base64url');
}

export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/** « Bearer prm_… » → « prm_… », sinon null. */
export function jetonDeLEntete(entete: string | null | undefined): string | null {
  const m = /^Bearer\s+(prm_[A-Za-z0-9_-]{20,})$/.exec((entete ?? '').trim());
  return m ? m[1] : null;
}
