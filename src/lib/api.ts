import * as SecureStore from 'expo-secure-store';
import { ADMIN_URL, PLANNING_URL } from './config';

/**
 * Appels réseau. Les jetons vivent dans le trousseau du téléphone (Keychain
 * iOS, Keystore Android), lisibles seulement quand le téléphone est
 * déverrouillé et jamais copiés sur un autre appareil ni dans une sauvegarde.
 */

const OPTIONS_TROUSSEAU: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const CLE_JETON_PLANNING = 'jeton-planning';
export const CLE_JETON_ANNUAIRE = 'jeton-annuaire';
export const CLE_CHIFFREMENT_ANNUAIRE = 'cle-annuaire';

export async function lireSecret(cle: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(cle, OPTIONS_TROUSSEAU);
  } catch {
    return null;
  }
}

export async function ecrireSecret(cle: string, valeur: string): Promise<void> {
  await SecureStore.setItemAsync(cle, valeur, OPTIONS_TROUSSEAU);
}

export async function effacerSecret(cle: string): Promise<void> {
  await SecureStore.deleteItemAsync(cle, OPTIONS_TROUSSEAU).catch(() => undefined);
}

/** Erreur d'appel, avec le motif de refus éventuel (voir lib/mobile/garde.ts du planning). */
export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly motif?: string,
  ) {
    super(message);
  }
  /** Le serveur ne veut plus de cet appareil : il faut tout effacer. */
  get appareilRefuse(): boolean {
    return this.status === 401 && (this.motif === 'revoque' || this.motif === 'inconnu' || this.motif === 'desactive');
  }
  get horsLigne(): boolean {
    return this.status === 0;
  }
}

async function appel<T>(url: string, init: RequestInit & { jeton?: string | null; delaiMs?: number } = {}): Promise<T> {
  const { jeton, delaiMs = 25_000, ...reste } = init;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...reste,
      signal: controleur.signal,
      headers: {
        Accept: 'application/json',
        ...(reste.body ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        ...(reste.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ErreurApi('Pas de connexion au serveur.', 0);
  } finally {
    clearTimeout(minuteur);
  }
  let corps: unknown = null;
  try {
    corps = await res.json();
  } catch {
    corps = null;
  }
  if (!res.ok) {
    const c = (corps ?? {}) as { error?: string; motif?: string };
    throw new ErreurApi(c.error || `Erreur ${res.status}`, res.status, c.motif);
  }
  return corps as T;
}

export const planning = <T>(chemin: string, init?: Parameters<typeof appel>[1]) => appel<T>(`${PLANNING_URL}${chemin}`, init);
export const admin = <T>(chemin: string, init?: Parameters<typeof appel>[1]) => appel<T>(`${ADMIN_URL}${chemin}`, init);
