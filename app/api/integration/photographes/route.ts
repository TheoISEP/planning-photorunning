import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

/**
 * LES PHOTOGRAPHES DU PLANNING, POUR L'ANNUAIRE DE L'ADMIN (27/10/2026,
 * Théo : « prendre tous les photographes de PhotoRunning qui sont dans le
 * planning, sauf les tests, et les mettre dans l'annuaire »).
 *
 * Même clé partagée que /api/integration/couts (ADMIN_INTEGRATION_KEY côté
 * planning = PLANNING_INTEGRATION_KEY côté admin). On rend les comptes de
 * rôle photographe, actifs ou non (l'annuaire le précise), SANS les comptes
 * de test : un nom, un prénom ou un email qui contient « test », ou une
 * adresse @example.*. Les admins du planning (Théo, David, Richard) ne sont
 * pas des photographes à annuaire : ils n'y figurent pas.
 */

function autorise(req: NextRequest): boolean {
  const attendu = process.env.ADMIN_INTEGRATION_KEY ?? '';
  const recu = req.headers.get('x-integration-key') ?? '';
  if (!attendu || attendu.length < 16 || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

function estUnTest(u: { name: string; prenom: string; nom: string; email: string }): boolean {
  const texte = `${u.name} ${u.prenom} ${u.nom}`.toLowerCase();
  const email = u.email.toLowerCase();
  return /\btest\b|\btests\b|testeur|^test|test\d|demo\b/.test(texte) || /test|@example\.|@exemple\./.test(email);
}

export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const users = await db.user.findMany({
    where: { role: 'photographer' },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    select: {
      id: true,
      name: true,
      prenom: true,
      nom: true,
      email: true,
      telephone: true,
      ville: true,
      region: true,
      actif: true,
      accord: true,
      inCharge: true,
      personUrgency: true,
      numberUrgency: true,
      dateInscription: true,
    },
  });

  const photographes = users
    .filter((u) => !estUnTest(u))
    .map((u) => {
      const [prenomDeduit = '', ...reste] = (u.name ?? '').trim().split(/\s+/);
      return {
        id: u.id,
        prenom: u.prenom.trim() || prenomDeduit,
        nom: u.nom.trim() || reste.join(' '),
        email: u.email,
        telephone: u.telephone?.trim() || null,
        ville: u.ville?.trim() || null,
        region: u.region?.trim() || null,
        actif: u.actif,
        accordSigne: u.accord,
        referent: u.inCharge,
        urgence:
          u.personUrgency || u.numberUrgency
            ? `${u.personUrgency ?? ''} ${u.numberUrgency ?? ''}`.trim()
            : null,
        inscritLe: u.dateInscription.toISOString(),
      };
    });

  return NextResponse.json({ total: users.length, exclus: users.length - photographes.length, photographes });
}
