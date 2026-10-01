import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  normalizePostgresSslMode,
  selectRuntimeDatabaseUrl,
} from '@/lib/databaseUrl';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const rawConnectionString = selectRuntimeDatabaseUrl(process.env);
const connectionString = normalizePostgresSslMode(rawConnectionString);

if (!connectionString) {
  throw new Error(
    'Missing PREVIEW_DATABASE_URL (for Vercel Preview), DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL_NON_POOLING.',
  );
}

const adapter = new PrismaPg({ connectionString });

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
