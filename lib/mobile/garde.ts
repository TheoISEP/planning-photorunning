import { NextRequest, NextResponse } from 'next/server';
import { appareilDeLEntete, estRefus, type AppareilConnecte } from './appareils';

/**
 * Garde des routes /api/mobile/* : l'appareil doit présenter un jeton valide.
 * Le motif du refus est renvoyé à l'app, qui en déduit quoi faire :
 *  - revoque / inconnu / desactive → elle se déconnecte et EFFACE ses données
 *  - pas de jeton                  → elle affiche la connexion
 */
export async function appareilOuRefus(req: NextRequest): Promise<AppareilConnecte | NextResponse> {
  const a = await appareilDeLEntete(req.headers.get('authorization'));
  if (!a) return NextResponse.json({ error: 'Non authentifié', motif: 'absent' }, { status: 401 });
  if (estRefus(a)) {
    const messages = {
      revoque: 'Cet appareil a été déconnecté par un administrateur.',
      inconnu: 'Session expirée, reconnecte-toi.',
      desactive: 'Ton compte est désactivé.',
    } as const;
    return NextResponse.json({ error: messages[a.refus], motif: a.refus }, { status: 401 });
  }
  return a;
}

export const estReponse = (x: unknown): x is NextResponse => x instanceof NextResponse;
