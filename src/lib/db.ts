import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const previewConnectionString =
  process.env.VERCEL_ENV === 'preview'
    ? process.env.PREVIEW_DATABASE_URL?.trim()
    : undefined;

const connectionString =
  previewConnectionString ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    'Missing PREVIEW_DATABASE_URL, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_PRISMA_URL.',
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
