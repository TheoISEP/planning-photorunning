/**
 * Adresses des serveurs. Le téléphone ne parle qu'à deux endroits :
 *  - le planning (jecourse.fr) : connexion, planning, briefs, contacts ;
 *  - l'admin (adminphotorunning.fr) : l'annuaire, pour les admins, avec les
 *    comptes de l'annuaire.
 *
 * On peut les changer sans toucher au code avec EXPO_PUBLIC_PLANNING_URL et
 * EXPO_PUBLIC_ADMIN_URL (dans eas.json, par profil de build).
 */
const sansSlash = (u: string) => u.replace(/\/+$/, '');

export const PLANNING_URL = sansSlash(process.env.EXPO_PUBLIC_PLANNING_URL ?? 'https://www.jecourse.fr');
export const ADMIN_URL = sansSlash(process.env.EXPO_PUBLIC_ADMIN_URL ?? 'https://www.adminphotorunning.fr');

/** Briefs dont les fichiers sont téléchargés d'office chez un admin (jours avant / après la course). */
export const ADMIN_FENETRE_FICHIERS = { avant: 3, apres: 21 };

/** Sans synchro de l'annuaire depuis ce délai, la copie du téléphone est effacée. */
export const ANNUAIRE_DUREE_MAX_MS = 14 * 86_400_000;

/** L'annuaire se reverrouille après ce temps passé hors de l'app. */
export const ANNUAIRE_VERROU_ARRIERE_PLAN_MS = 2 * 60_000;

/** Pas plus d'une synchro automatique par… */
export const SYNCHRO_INTERVALLE_MIN_MS = 60_000;
