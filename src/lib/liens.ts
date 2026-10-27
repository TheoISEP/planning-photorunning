/**
 * Lien ouvert avant la connexion (un brief partagé reçu par SMS) : on le garde
 * le temps que la personne se connecte, puis on l'ouvre.
 */
let lienEnAttente: string | null = null;

export function memoriserLien(chemin: string) {
  lienEnAttente = chemin;
}

export function reprendreLien(): string | null {
  const l = lienEnAttente;
  lienEnAttente = null;
  return l;
}
