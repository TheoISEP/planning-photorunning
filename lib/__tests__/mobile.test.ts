import { describe, expect, it } from 'vitest';
import { comparerVersions, etatDeVersion, partiesDeVersion, versionValide } from '../mobile/version';
import { empreinteJeton, jetonDeLEntete, nouveauJeton } from '../mobile/jeton';

describe('versions de l’app mobile', () => {
  it('compare numériquement, pas comme du texte', () => {
    expect(comparerVersions('1.10.0', '1.9.9')).toBe(1);
    expect(comparerVersions('1.2', '1.2.0')).toBe(0);
    expect(comparerVersions('v2.0.1', '2.0.2')).toBe(-1);
  });
  it('lit les morceaux illisibles comme 0', () => {
    expect(partiesDeVersion('1.x.3')).toEqual([1, 0, 3]);
  });
  it('bloque sous le minimum, prévient sous la dernière', () => {
    const c = { minVersion: '1.2.0', latestVersion: '1.4.0' };
    expect(etatDeVersion('1.1.9', c)).toBe('obligatoire');
    expect(etatDeVersion('1.3.0', c)).toBe('recommandee');
    expect(etatDeVersion('1.4.0', c)).toBe('ok');
    expect(etatDeVersion('', c)).toBe('ok');
  });
  it('n’accepte que le format 1.2.3 dans le réglage', () => {
    expect(versionValide('1.2.3')).toBe(true);
    expect(versionValide('1.2')).toBe(false);
  });
});

describe('jetons d’appareil', () => {
  it('ne lit que les jetons prm_ bien formés', () => {
    const j = nouveauJeton();
    expect(jetonDeLEntete(`Bearer ${j}`)).toBe(j);
    expect(jetonDeLEntete('Bearer abc')).toBeNull();
    expect(jetonDeLEntete(null)).toBeNull();
  });
  it('stocke une empreinte stable, jamais le jeton', () => {
    const j = nouveauJeton();
    expect(empreinteJeton(j)).toBe(empreinteJeton(j));
    expect(empreinteJeton(j)).not.toContain(j);
    expect(empreinteJeton(j)).toHaveLength(64);
  });
});
