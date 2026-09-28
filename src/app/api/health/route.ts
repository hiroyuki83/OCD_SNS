import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function releaseSha() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    'unknown'
  );
}

export async function GET() {
  const sha = releaseSha();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: 'ok',
        database: 'ok',
        releaseSha: sha,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch {
    return Response.json(
      {
        status: 'degraded',
        database: 'unavailable',
        releaseSha: sha,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }
}
