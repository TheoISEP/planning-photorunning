/**
 * Découpage du Markdown des briefs en blocs et en morceaux de texte (pur,
 * testé dans tests/outils.test.ts). Le rendu est dans components/brief/Markdown.tsx.
 */

export type Morceau = { texte: string; gras?: boolean; italique?: boolean; lien?: string; code?: boolean };

export function morceauxEnLigne(source: string): Morceau[] {
  const s = source.replace(/<[^>]+>/g, '');
  const sortie: Morceau[] = [];
  const motif = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|(https?:\/\/[^\s)]+)/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(s))) {
    if (m.index > dernier) sortie.push({ texte: s.slice(dernier, m.index) });
    if (m[2] !== undefined) sortie.push({ texte: m[2], gras: true });
    else if (m[4] !== undefined) sortie.push({ texte: m[4], italique: true });
    else if (m[5] !== undefined) sortie.push({ texte: m[5], lien: m[6] });
    else if (m[7] !== undefined) sortie.push({ texte: m[7], code: true });
    else if (m[8] !== undefined) sortie.push({ texte: m[8], lien: m[8] });
    dernier = motif.lastIndex;
  }
  if (dernier < s.length) sortie.push({ texte: s.slice(dernier) });
  return sortie;
}

export type Bloc =
  | { type: 'titre'; niveau: number; texte: string }
  | { type: 'paragraphe'; texte: string }
  | { type: 'liste'; ordonnee: boolean; items: string[] }
  | { type: 'citation'; texte: string }
  | { type: 'separateur' };

export function blocs(source: string): Bloc[] {
  const lignes = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  const sortie: Bloc[] = [];
  let paragraphe: string[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;
  const fermer = () => {
    if (paragraphe.length) sortie.push({ type: 'paragraphe', texte: paragraphe.join('\n') });
    paragraphe = [];
    if (liste) sortie.push({ type: 'liste', ...liste });
    liste = null;
  };
  for (const brute of lignes) {
    const ligne = brute.trimEnd();
    if (!ligne.trim()) {
      fermer();
      continue;
    }
    const titre = /^(#{1,6})\s+(.*)$/.exec(ligne);
    const puce = /^\s*[-*+]\s+(.*)$/.exec(ligne);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);
    if (titre) {
      fermer();
      sortie.push({ type: 'titre', niveau: titre[1].length, texte: titre[2] });
    } else if (/^\s*(---|\*\*\*|___)\s*$/.test(ligne)) {
      fermer();
      sortie.push({ type: 'separateur' });
    } else if (puce || numero) {
      if (paragraphe.length) {
        sortie.push({ type: 'paragraphe', texte: paragraphe.join('\n') });
        paragraphe = [];
      }
      const ordonnee = !!numero;
      if (!liste || liste.ordonnee !== ordonnee) {
        if (liste) sortie.push({ type: 'liste', ...liste });
        liste = { ordonnee, items: [] };
      }
      liste.items.push((puce ?? numero)![1]);
    } else if (/^>\s?/.test(ligne)) {
      fermer();
      sortie.push({ type: 'citation', texte: ligne.replace(/^>\s?/, '') });
    } else {
      if (liste) {
        sortie.push({ type: 'liste', ...liste });
        liste = null;
      }
      paragraphe.push(ligne);
    }
  }
  fermer();
  return sortie;
}
