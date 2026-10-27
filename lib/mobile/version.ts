/**
 * Versions de l'app mobile (« 1.4.2 ») — fonctions pures, testées.
 *
 * L'admin règle deux seuils dans « App mobile » :
 *  - minVersion    : en dessous, écran bloquant « Mets à jour pour continuer »
 *  - latestVersion : en dessous, simple bandeau « Nouvelle version disponible »
 */

/** « 1.4.2 » → [1, 4, 2] ; tout ce qui n'est pas un nombre compte pour 0. */
export function partiesDeVersion(v: string): number[] {
  return String(v ?? '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .slice(0, 3)
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/** -1 si a < b, 0 si égales, 1 si a > b. « 1.2 » vaut « 1.2.0 ». */
export function comparerVersions(a: string, b: string): number {
  const pa = partiesDeVersion(a);
  const pb = partiesDeVersion(b);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export const versionValide = (v: string) => /^\d+\.\d+\.\d+$/.test(String(v ?? '').trim());

export type EtatVersion = 'ok' | 'recommandee' | 'obligatoire';

export function etatDeVersion(installee: string, config: { minVersion: string; latestVersion: string }): EtatVersion {
  if (!installee) return 'ok';
  if (comparerVersions(installee, config.minVersion) < 0) return 'obligatoire';
  if (comparerVersions(installee, config.latestVersion) < 0) return 'recommandee';
  return 'ok';
}
