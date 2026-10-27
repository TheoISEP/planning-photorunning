import { db } from '@/lib/db';
import { empreinteJeton, jetonDeLEntete } from './jeton';

/**
 * Qui parle depuis l'app mobile ? Le jeton de l'en-tête Authorization est
 * cherché par son empreinte ; un appareil révoqué ou un compte désactivé ne
 * passe pas. On note le passage (au plus une écriture par minute).
 */

const INACTIVITE_MAX_MS = 60 * 86_400_000;

export type AppareilConnecte = {
  deviceId: string;
  user: { id: string; email: string; role: 'admin' | 'photographer'; nom: string; prenom: string };
};

export type RefusAppareil = { refus: 'revoque' | 'inconnu' | 'desactive' };

export async function appareilDeLEntete(entete: string | null): Promise<AppareilConnecte | RefusAppareil | null> {
  const jeton = jetonDeLEntete(entete);
  if (!jeton) return null;
  const appareil = await db.mobileDevice.findUnique({
    where: { tokenHash: empreinteJeton(jeton) },
    select: {
      id: true,
      revokedAt: true,
      lastSeenAt: true,
      user: { select: { id: true, email: true, role: true, nom: true, prenom: true, actif: true } },
    },
  });
  if (!appareil) return { refus: 'inconnu' };
  if (appareil.revokedAt) return { refus: 'revoque' };
  if (!appareil.user.actif) return { refus: 'desactive' };
  // Téléphone resté 60 jours sans parler au serveur : il doit se reconnecter.
  if (Date.now() - appareil.lastSeenAt.getTime() > INACTIVITE_MAX_MS) {
    await db.mobileDevice.update({ where: { id: appareil.id }, data: { revokedAt: new Date(), revokedBy: 'inactivite' } }).catch(() => undefined);
    return { refus: 'inconnu' };
  }
  if (Date.now() - appareil.lastSeenAt.getTime() > 60_000) {
    await db.mobileDevice.update({ where: { id: appareil.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const { actif: _actif, ...user } = appareil.user;
  void _actif;
  return { deviceId: appareil.id, user };
}

export const estRefus = (x: AppareilConnecte | RefusAppareil | null): x is RefusAppareil => !!x && 'refus' in x;

/** Infos d'appareil envoyées par l'app (bornées, jamais de confiance). */
export function infosAppareil(v: unknown) {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const t = (x: unknown, max = 80) => (typeof x === 'string' ? x.slice(0, max) : '');
  const plateforme = t(o.platform, 10);
  return {
    platform: plateforme === 'ios' || plateforme === 'android' ? plateforme : '',
    deviceName: t(o.deviceName),
    model: t(o.model),
    osVersion: t(o.osVersion, 20),
    appVersion: t(o.appVersion, 20),
    buildNumber: t(o.buildNumber, 20),
    updateId: t(o.updateId, 60) || null,
  };
}

export async function configApp() {
  return db.mobileAppConfig.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
}
