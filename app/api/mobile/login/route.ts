import { NextRequest, NextResponse } from 'next/server';
import { APIError } from 'better-auth/api';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { empreinteJeton, nouveauJeton } from '@/lib/mobile/jeton';
import { infosAppareil } from '@/lib/mobile/appareils';

/**
 * POST /api/mobile/login — connexion depuis l'app, avec les identifiants du
 * planning (aucun compte en plus). Le mot de passe est vérifié par better-auth
 * lui-même (bcrypt, comptes désactivés refusés), puis la session web créée au
 * passage est aussitôt effacée : l'app reçoit à la place un jeton d'appareil,
 * révocable depuis « App mobile » dans l'admin.
 *
 * Limite : 5 essais par 5 minutes par adresse, 20 par adresse IP.
 */

const FENETRE_S = 300;

async function limite(cle: string, max: number): Promise<boolean> {
  const maintenant = Date.now();
  const ligne = await db.rateLimit.findUnique({ where: { key: cle } });
  if (!ligne || maintenant - Number(ligne.lastRequest) > FENETRE_S * 1000) {
    await db.rateLimit.upsert({
      where: { key: cle },
      create: { key: cle, count: 1, lastRequest: BigInt(maintenant) },
      update: { count: 1, lastRequest: BigInt(maintenant) },
    });
    return true;
  }
  if (ligne.count >= max) return false;
  await db.rateLimit.update({ where: { key: cle }, data: { count: { increment: 1 } } });
  return true;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? '').slice(0, 200);
  if (!email || !password) return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  if (!(await limite(`mobile-login:ip:${ip}`, 20)) || !(await limite(`mobile-login:email:${email}`, 5))) {
    return NextResponse.json({ error: 'Trop d’essais. Réessaie dans quelques minutes.' }, { status: 429 });
  }

  let userId: string;
  try {
    const r = await auth.api.signInEmail({ body: { email, password }, headers: req.headers });
    userId = r.user.id;
    // La session web n'a pas d'usage ici : l'app vit avec son jeton d'appareil.
    if (r.token) await db.session.deleteMany({ where: { token: r.token } });
  } catch (err) {
    if (err instanceof APIError) {
      const desactive = (err.body as { code?: string } | undefined)?.code === 'ACCOUNT_DISABLED';
      return NextResponse.json(
        { error: desactive ? 'Ce compte est désactivé.' : 'Email ou mot de passe incorrect.' },
        { status: desactive ? 403 : 401 },
      );
    }
    console.error('[mobile] login', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, prenom: true, nom: true, name: true, actif: true },
  });
  if (!user || !user.actif) return NextResponse.json({ error: 'Ce compte est désactivé.' }, { status: 403 });

  const jeton = nouveauJeton();
  const appareil = await db.mobileDevice.create({
    data: { userId: user.id, tokenHash: empreinteJeton(jeton), ...infosAppareil(body.device) },
    select: { id: true },
  });
  console.info(`[mobile] connexion de ${user.email} (appareil ${appareil.id})`);
  return NextResponse.json({
    token: jeton,
    deviceId: appareil.id,
    user: { id: user.id, email: user.email, role: user.role, prenom: user.prenom || user.name.split(' ')[0] || '', nom: user.nom },
  });
}
