import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { APIError } from 'better-auth/api';
import bcrypt from 'bcryptjs';
import { db } from './db';

// Même socle que photorunning-admin / photorunning-upload (better-auth 1.6.26
// + adaptateur Prisma + cookies Next), sans 2FA.
//
// Les mots de passe sont des hashs bcrypt repris tels quels de l'ancien
// Google Sheet : on remplace le hachage par défaut de better-auth (scrypt)
// par bcrypt pour que personne ne soit bloqué à la bascule.

export const auth = betterAuth({
  appName: 'Planning PhotoRunning',
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql' }),
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: false,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', input: false },
      prenom: { type: 'string', input: false },
      nom: { type: 'string', input: false },
      actif: { type: 'boolean', input: false },
    },
  },
  session: {
    // Outil de planning : 14 jours, prolongés à chaque journée d'usage.
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Un compte désactivé (actif = false) ne peut pas ouvrir de session.
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { actif: true },
          });
          if (!user || !user.actif) {
            throw new APIError('FORBIDDEN', {
              code: 'ACCOUNT_DISABLED',
              message: 'Compte désactivé',
            });
          }
          return { data: session };
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 30,
    max: 20,
    storage: 'database',
    modelName: 'rateLimit',
    customRules: {
      '/sign-in/email': { window: 30, max: 5 },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
