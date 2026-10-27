import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparerVersions, etatDeVersion } from '../src/lib/versions.ts';
import { depuisHex, depuisUtf8, versHex, versUtf8 } from '../src/lib/octets.ts';
import { alleger, cadreDe, lireTrace, projeteur } from '../src/lib/trace.ts';
import { blocs, morceauxEnLigne } from '../src/lib/markdown.ts';

test('versions : même règle que le planning', () => {
  assert.equal(comparerVersions('1.10.0', '1.9.9'), 1);
  assert.equal(comparerVersions('1.2', '1.2.0'), 0);
  assert.equal(etatDeVersion('1.0.0', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'obligatoire');
  assert.equal(etatDeVersion('1.1.5', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'recommandee');
  assert.equal(etatDeVersion('1.2.0', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'ok');
  assert.equal(etatDeVersion('1.0.0', null), 'ok');
});

test('UTF-8 aller-retour, accents, emoji et caractères rares', () => {
  const s = 'Équipe à Saint-Étienne 🏃‍♀️ — 東京 ½ ‘’  ';
  assert.equal(depuisUtf8(versUtf8(s)), s);
  assert.deepEqual([...versUtf8('é')], [0xc3, 0xa9]);
  assert.deepEqual([...versUtf8('😀')], [0xf0, 0x9f, 0x98, 0x80]);
  const long = 'x'.repeat(50_000) + 'é';
  assert.equal(depuisUtf8(versUtf8(long)), long);
});

test('hex aller-retour', () => {
  const o = new Uint8Array([0, 1, 127, 128, 255]);
  assert.equal(versHex(o), '00017f80ff');
  assert.deepEqual([...depuisHex('00017f80ff')], [...o]);
  assert.throws(() => depuisHex('zz'));
});

test('trace GPX et KML', () => {
  const gpx = '<gpx><trk><trkseg><trkpt lat="45.1" lon="4.8"/><trkpt lon="4.9" lat="45.2"></trkpt></trkseg></trk></gpx>';
  assert.deepEqual(lireTrace(gpx), [[{ lat: 45.1, lon: 4.8 }, { lat: 45.2, lon: 4.9 }]]);
  const kml = '<kml><coordinates>4.8,45.1,0 4.9,45.2,0</coordinates></kml>';
  assert.deepEqual(lireTrace(kml, 'p.kml'), [[{ lat: 45.1, lon: 4.8 }, { lat: 45.2, lon: 4.9 }]]);
  const pts = Array.from({ length: 5000 }, (_, i) => ({ lat: i, lon: i }));
  const a = alleger(pts, 1000);
  assert.ok(a.length <= 1001);
  assert.deepEqual(a[a.length - 1], pts[pts.length - 1]);
  const c = cadreDe([[{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }]])!;
  const pr = projeteur(c, 200, 200, 0);
  const haut = pr({ lat: 1, lon: 0 });
  assert.ok(Math.abs(haut.y) < 1e-6, 'le nord est en haut');
});

test('Markdown : blocs et morceaux', () => {
  const b = blocs('# Titre\n\nUn **gras** et un [lien](https://x.fr).\n\n- un\n- deux\n\n1. a\n2. b');
  assert.deepEqual(b.map((x) => x.type), ['titre', 'paragraphe', 'liste', 'liste']);
  const m = morceauxEnLigne('a **b** _c_ [d](https://e.fr) https://f.fr <b>g</b>');
  assert.ok(m.some((x) => x.gras && x.texte === 'b'));
  assert.ok(m.some((x) => x.italique && x.texte === 'c'));
  assert.ok(m.some((x) => x.lien === 'https://e.fr' && x.texte === 'd'));
  assert.ok(m.some((x) => x.lien === 'https://f.fr'));
  assert.ok(!m.some((x) => x.texte.includes('<b>')));
});
