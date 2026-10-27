/**
 * Comparaison des versions de l'app, identique au planning
 * (lib/mobile/version.ts) : « 1.10.0 » > « 1.9.9 », « 1.2 » = « 1.2.0 ».
 */

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

export type EtatVersion = 'ok' | 'recommandee' | 'obligatoire';

export function etatDeVersion(installee: string | null | undefined, config: { minVersion: string; latestVersion: string } | null): EtatVersion {
  if (!installee || !config) return 'ok';
  if (comparerVersions(installee, config.minVersion) < 0) return 'obligatoire';
  if (comparerVersions(installee, config.latestVersion) < 0) return 'recommandee';
  return 'ok';
}
