import * as Updates from 'expo-updates';

/**
 * Corrections à chaud (EAS Update) : au lancement, expo-updates vérifie seul ;
 * au retour dans l'app, on revérifie (au plus toutes les 30 minutes). Une
 * correction téléchargée s'applique au prochain lancement, ou tout de suite
 * via le bandeau « Redémarrer ».
 */
let derniere = 0;

export async function verifierMiseAJourAChaud() {
  if (!Updates.isEnabled || __DEV__) return;
  if (Date.now() - derniere < 30 * 60_000) return;
  derniere = Date.now();
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // hors ligne ou serveur indisponible : on réessaiera
  }
}
