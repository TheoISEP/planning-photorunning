import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Client Prisma partagé (un seul par process, y compris en dev avec le HMR).
// Driver pg + queryCompiler : pas de moteur binaire à télécharger, ce qui
// simplifie les builds Vercel et le développement hors ligne.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Pas d'erreur à l'import (le build Next évalue les modules) : la
    // première requête échouera avec un message clair.
    console.warn('DATABASE_URL manquante : la base ne sera pas joignable');
  }
  const adapter = new PrismaPg({ connectionString: connectionString ?? '' });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
