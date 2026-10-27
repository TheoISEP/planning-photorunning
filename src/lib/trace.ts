/**
 * Traces de parcours (GPX, KML) lues sans bibliothèque XML : on ne garde que
 * les points, pour dessiner le parcours hors ligne (sans fond de carte, qui
 * demanderait du réseau). Testé (tests/outils.test.ts).
 */

export type Point = { lat: number; lon: number };

export function lirePointsGpx(xml: string): Point[][] {
  const traces: Point[][] = [];
  const segments = xml.match(/<trkseg[\s\S]*?<\/trkseg>/gi) ?? xml.match(/<rte[\s\S]*?<\/rte>/gi) ?? [];
  for (const seg of segments) {
    const pts: Point[] = [];
    const re = /<(?:trkpt|rtept)\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) {
      const lat = /lat\s*=\s*["']([-\d.]+)["']/i.exec(m[1]);
      const lon = /lon\s*=\s*["']([-\d.]+)["']/i.exec(m[1]);
      if (lat && lon) pts.push({ lat: Number(lat[1]), lon: Number(lon[1]) });
    }
    if (pts.length > 1) traces.push(pts);
  }
  return traces;
}

export function lirePointsKml(xml: string): Point[][] {
  const traces: Point[][] = [];
  const re = /<coordinates>([\s\S]*?)<\/coordinates>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const pts = m[1]
      .trim()
      .split(/\s+/)
      .map((t) => t.split(',').map(Number))
      .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([lon, lat]) => ({ lat, lon }));
    if (pts.length > 1) traces.push(pts);
  }
  return traces;
}

export function lireTrace(contenu: string, nomFichier?: string | null): Point[][] {
  const kml = (nomFichier ?? '').toLowerCase().endsWith('.kml') || /<kml[\s>]/i.test(contenu);
  return kml ? lirePointsKml(contenu) : lirePointsGpx(contenu);
}

/** Réduit une trace trop dense (garde un point sur n) pour un dessin fluide. */
export function alleger(points: Point[], max = 1500): Point[] {
  if (points.length <= max) return points;
  const pas = Math.ceil(points.length / max);
  const sortie = points.filter((_, i) => i % pas === 0);
  if (sortie[sortie.length - 1] !== points[points.length - 1]) sortie.push(points[points.length - 1]);
  return sortie;
}

export interface Cadre {
  nord: number;
  sud: number;
  est: number;
  ouest: number;
}

export function cadreDe(traces: Point[][], extra: Point[] = []): Cadre | null {
  const tous = [...traces.flat(), ...extra];
  if (tous.length === 0) return null;
  return {
    nord: Math.max(...tous.map((p) => p.lat)),
    sud: Math.min(...tous.map((p) => p.lat)),
    est: Math.max(...tous.map((p) => p.lon)),
    ouest: Math.min(...tous.map((p) => p.lon)),
  };
}

/**
 * Projection simple (équirectangulaire corrigée de la latitude) dans un
 * rectangle largeur × hauteur avec une marge : suffisante à l'échelle d'une
 * course, et l'aspect du parcours est respecté.
 */
export function projeteur(c: Cadre, largeur: number, hauteur: number, marge = 16) {
  const cosLat = Math.cos((((c.nord + c.sud) / 2) * Math.PI) / 180);
  const dx = Math.max((c.est - c.ouest) * cosLat, 1e-6);
  const dy = Math.max(c.nord - c.sud, 1e-6);
  const echelle = Math.min((largeur - 2 * marge) / dx, (hauteur - 2 * marge) / dy);
  const decalX = (largeur - dx * echelle) / 2;
  const decalY = (hauteur - dy * echelle) / 2;
  return (p: Point) => ({
    x: decalX + (p.lon - c.ouest) * cosLat * echelle,
    y: decalY + (c.nord - p.lat) * echelle,
  });
}
