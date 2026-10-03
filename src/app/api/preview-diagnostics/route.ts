import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'preview'
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [public1, admin] = await Promise.all([
    prisma.user.findUnique({
      where: { email: 'coco.preview.public1@example.com' },
      select: {
        password: true,
        emailVerifiedAt: true,
        role: true,
        status: true,
        staffTotpEnabledAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { email: 'coco.preview.admin@example.com' },
      select: {
        password: true,
        emailVerifiedAt: true,
        role: true,
        status: true,
        staffTotpEnabledAt: true,
      },
    }),
  ]);

  return NextResponse.json(
    {
      branch: process.env.VERCEL_GIT_COMMIT_REF,
      previewDatabaseConfigured: Boolean(process.env.PREVIEW_DATABASE_URL),
      public1: public1
        ? {
            exists: true,
            emailVerified: Boolean(public1.emailVerifiedAt),
            role: public1.role,
            status: public1.status,
            staffTotpEnabled: Boolean(public1.staffTotpEnabledAt),
          }
        : { exists: false },
      admin: admin
        ? {
            exists: true,
            emailVerified: Boolean(admin.emailVerifiedAt),
            role: admin.role,
            status: admin.status,
            staffTotpEnabled: Boolean(admin.staffTotpEnabledAt),
          }
        : { exists: false },
      passwordHashesEqual:
        Boolean(public1?.password) &&
        Boolean(admin?.password) &&
        public1?.password === admin?.password,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
