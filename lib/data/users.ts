import type { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { toBool, toStringArray } from '../serialize';
import { ensureDisposForUser } from './courses';

const CHARGE_KEYS = ['chargeOne', 'chargeTwo', 'chargeThree', 'chargeFour', 'chargeFive'] as const;

const displayName = (prenom: string, nom: string) => `${prenom} ${nom}`.trim() || 'Utilisateur';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Champs de profil acceptés depuis le front. */
export function profileDataFromInput(data: Record<string, unknown>): Prisma.UserUpdateInput {
  const out: Prisma.UserUpdateInput = {};
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);
  const strKeys = [
    'nom', 'prenom', 'telephone', 'adresse', 'ville', 'codePostal', 'dateNaissance',
    'flyingBlue', 'flyingBlueExpiry', 'sncf', 'sncfExpiry', 'region', 'personUrgency', 'numberUrgency',
  ] as const;
  for (const k of strKeys) {
    const v = str(k);
    if (v !== undefined) (out as Record<string, unknown>)[k] = v.trim();
  }
  for (const k of CHARGE_KEYS) {
    if (data[k] !== undefined) (out as Record<string, unknown>)[k] = typeof data[k] === 'string' && data[k] ? data[k] : null;
  }
  for (const k of ['cameras', 'objectifs', 'cartesMemoire', 'flashs'] as const) {
    if (data[k] !== undefined) (out as Record<string, unknown>)[k] = toStringArray(data[k]);
  }
  if (data.actif !== undefined) out.actif = toBool(data.actif, true);
  if (data.inCharge !== undefined) out.inCharge = toBool(data.inCharge);
  if (data.accord !== undefined) out.accord = toBool(data.accord);
  if (data.nonRemunere !== undefined) out.nonRemunere = toBool(data.nonRemunere);
  else if (data.rem !== undefined) out.nonRemunere = toBool(data.rem);
  return out;
}

export interface CreateUserInput {
  role: UserRole;
  email: string;
  password: string;
  profile: Record<string, unknown>;
}

/** Crée un compte (user + account credential) avec un id lisible. */
export async function createUser(input: CreateUserInput) {
  const email = normalizeEmail(input.email);
  const profile = profileDataFromInput(input.profile) as Prisma.UserCreateInput;
  const prenom = (profile.prenom as string | undefined) ?? '';
  const nom = (profile.nom as string | undefined) ?? '';
  const id = `${input.role === 'admin' ? 'admin' : 'photographe'}-${Date.now()}`;
  const hashed = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...profile,
        id,
        email,
        name: displayName(prenom, nom),
        role: input.role,
        emailVerified: true,
        accounts: {
          create: { id: `acc-${id}`, accountId: id, providerId: 'credential', password: hashed },
        },
      },
    });
    await ensureDisposForUser(tx, created.id);
    return created;
  });
  return user;
}

/** Met à jour un profil (et le mot de passe si fourni). */
export async function updateUser(id: string, data: Record<string, unknown>, options: { allowPassword?: boolean; allowEmail?: boolean } = {}) {
  const profile = profileDataFromInput(data);
  const current = await db.user.findUnique({ where: { id } });
  if (!current) throw new Error('Utilisateur introuvable');

  const prenom = (profile.prenom as string | undefined) ?? current.prenom;
  const nom = (profile.nom as string | undefined) ?? current.nom;
  const update: Prisma.UserUpdateInput = { ...profile, name: displayName(prenom, nom) };
  if (options.allowEmail && typeof data.email === 'string' && data.email.trim()) {
    update.email = normalizeEmail(data.email);
  }

  const password = options.allowPassword && typeof data.password === 'string' && data.password ? data.password : null;

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: update });
    if (password) {
      const hashed = await hashPassword(password);
      const acc = await tx.account.findFirst({ where: { userId: id, providerId: 'credential' } });
      if (acc) await tx.account.update({ where: { id: acc.id }, data: { password: hashed } });
      else await tx.account.create({ data: { id: `acc-${id}`, accountId: id, providerId: 'credential', userId: id, password: hashed } });
      // Changement de mot de passe : on ferme les autres sessions
      await tx.session.deleteMany({ where: { userId: id } });
    }
    if (update.actif === true && current.actif === false) {
      await ensureDisposForUser(tx, id);
    }
    return u;
  });
  return user;
}

export async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function managedIds(userId: string): Promise<string[]> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { inCharge: true, chargeOne: true, chargeTwo: true, chargeThree: true, chargeFour: true, chargeFive: true },
  });
  if (!me) return [];
  return [me.chargeOne, me.chargeTwo, me.chargeThree, me.chargeFour, me.chargeFive].filter((x): x is string => !!x);
}
