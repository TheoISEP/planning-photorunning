import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from './auth';
import { db } from './db';

export interface SessionUser {
  id: string;
  email: string;
  role: 'admin' | 'photographer';
  nom: string;
  prenom: string;
}

/** Utilisateur connecté (session better-auth), ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as {
    id: string;
    email: string;
    role?: string;
    nom?: string;
    prenom?: string;
    actif?: boolean;
  };
  if (u.actif === false) return null;
  if (u.role !== 'admin' && u.role !== 'photographer') {
    // Champs additionnels absents du cache de cookie : relire en base.
    const fresh = await db.user.findUnique({
      where: { id: u.id },
      select: { id: true, email: true, role: true, nom: true, prenom: true, actif: true },
    });
    if (!fresh || !fresh.actif) return null;
    return { id: fresh.id, email: fresh.email, role: fresh.role, nom: fresh.nom, prenom: fresh.prenom };
  }
  return { id: u.id, email: u.email, role: u.role, nom: u.nom ?? '', prenom: u.prenom ?? '' };
}

export const unauthorized = () => NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
export const forbidden = (message = 'Accès refusé') => NextResponse.json({ error: message }, { status: 403 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const notFound = (message = 'Introuvable') => NextResponse.json({ error: message }, { status: 404 });
export const serverError = (message: string, error?: unknown) => {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
};

/**
 * Un photographe peut agir pour lui-même ou pour ses photographes à charge
 * (référent). Un admin peut tout.
 */
export async function canActFor(user: SessionUser, targetId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.id === targetId) return true;
  const me = await db.user.findUnique({
    where: { id: user.id },
    select: { chargeOne: true, chargeTwo: true, chargeThree: true, chargeFour: true, chargeFive: true },
  });
  if (!me) return false;
  return [me.chargeOne, me.chargeTwo, me.chargeThree, me.chargeFour, me.chargeFive].includes(targetId);
}
