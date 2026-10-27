/**
 * Conversions texte ↔ octets en JS pur : on ne dépend ni de TextEncoder /
 * TextDecoder ni de atob / btoa, dont la présence varie selon les moteurs.
 * Testé (tests/outils.test.ts).
 */

export function versUtf8(s: string): Uint8Array {
  const sortie = new Uint8Array(s.length * 3);
  let j = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) sortie[j++] = c;
    else if (c < 0x800) {
      sortie[j++] = 0xc0 | (c >> 6);
      sortie[j++] = 0x80 | (c & 63);
    } else if (c < 0x10000) {
      sortie[j++] = 0xe0 | (c >> 12);
      sortie[j++] = 0x80 | ((c >> 6) & 63);
      sortie[j++] = 0x80 | (c & 63);
    } else {
      // 4 octets : le tampon de 3 × longueur suffit (deux unités UTF-16 en entrée)
      sortie[j++] = 0xf0 | (c >> 18);
      sortie[j++] = 0x80 | ((c >> 12) & 63);
      sortie[j++] = 0x80 | ((c >> 6) & 63);
      sortie[j++] = 0x80 | (c & 63);
    }
  }
  return sortie.slice(0, j);
}

export function depuisUtf8(o: Uint8Array): string {
  const morceaux: string[] = [];
  let tampon: number[] = [];
  for (let i = 0; i < o.length; ) {
    const a = o[i++];
    let c: number;
    if (a < 0x80) c = a;
    else if (a < 0xe0) c = ((a & 31) << 6) | (o[i++] & 63);
    else if (a < 0xf0) c = ((a & 15) << 12) | ((o[i++] & 63) << 6) | (o[i++] & 63);
    else c = ((a & 7) << 18) | ((o[i++] & 63) << 12) | ((o[i++] & 63) << 6) | (o[i++] & 63);
    if (c > 0xffff) {
      c -= 0x10000;
      tampon.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    } else tampon.push(c);
    if (tampon.length > 8000) {
      morceaux.push(String.fromCharCode(...tampon));
      tampon = [];
    }
  }
  morceaux.push(String.fromCharCode(...tampon));
  return morceaux.join('');
}

const HEX = '0123456789abcdef';

export function versHex(o: Uint8Array): string {
  let s = '';
  for (let i = 0; i < o.length; i++) s += HEX[o[i] >> 4] + HEX[o[i] & 15];
  return s;
}

export function depuisHex(h: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(h) || h.length % 2) throw new Error('hex invalide');
  const o = new Uint8Array(h.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return o;
}
