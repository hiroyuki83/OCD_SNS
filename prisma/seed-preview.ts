import bcrypt from 'bcryptjs';
import { AccountStatus, PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const previewDatabaseUrl = process.env.PREVIEW_DATABASE_URL?.trim();
const password = process.env.PREVIEW_TEST_PASSWORD ?? '';

if (process.env.VERCEL_ENV !== 'preview') {
  console.error('Preview test users can only be seeded when VERCEL_ENV=preview.');
  process.exit(1);
}

if (process.env.VERCEL_GIT_COMMIT_REF !== 'security-integration-final-20260926') {
  console.error('Preview test users can only be seeded on security-integration-final-20260926.');
  process.exit(1);
}

if (process.env.PREVIEW_SEED_USERS !== '1') {
  console.error('PREVIEW_SEED_USERS=1 is required to seed preview test users.');
  process.exit(1);
}

if (!previewDatabaseUrl) {
  console.error('PREVIEW_DATABASE_URL is required.');
  process.exit(1);
}

if (password.length < 10 || password.length > 128) {
  console.error('PREVIEW_TEST_PASSWORD must be 10-128 characters.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: previewDatabaseUrl }),
});

const TEST_USERS = [
  {
    email: 'coco.preview.public1@example.com',
    handle: 'preview-public-1',
    name: 'Preview 公開ユーザー1',
    role: Role.USER,
    isPrivate: false,
    bio: 'Preview環境の公開テストユーザーです。',
  },
  {
    email: 'coco.preview.public2@example.com',
    handle: 'preview-public-2',
    name: 'Preview 公開ユーザー2',
    role: Role.USER,
    isPrivate: false,
    bio: 'フォロー・通知・ブロック確認用の公開テストユーザーです。',
  },
  {
    email: 'coco.preview.private@example.com',
    handle: 'preview-private',
    name: 'Preview 非公開ユーザー',
    role: Role.USER,
    isPrivate: true,
    bio: '非公開アカウントとフォロー申請の確認用です。',
  },
  {
    email: 'coco.preview.moderator@example.com',
    handle: 'preview-moderator',
    name: 'Preview Moderator',
    role: Role.MODERATOR,
    isPrivate: false,
    bio: 'Preview環境のモデレーター確認用です。',
  },
  {
    email: 'coco.preview.admin@example.com',
    handle: 'preview-admin',
    name: 'Preview Admin',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'Preview環境の管理者確認用です。',
  },
] as const;

async function run() {
  const passwordHash = await bcrypt.hash(password, 10);
  const verifiedAt = new Date();

  for (const seed of TEST_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: seed.email },
      select: { id: true },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: seed.email,
            handle: seed.handle,
            name: seed.name,
            bio: seed.bio,
            password: passwordHash,
            emailVerifiedAt: verifiedAt,
            role: seed.role,
            status: AccountStatus.ACTIVE,
            isPrivate: seed.isPrivate,
            restrictionReason: null,
            restrictionUntil: null,
            suspendedUntil: null,
            staffTotpSecretEncrypted: null,
            staffTotpEnabledAt: null,
            staffTotpLastUsedStep: null,
            sessionVersion: { increment: 1 },
          },
          select: { id: true, email: true, handle: true, role: true, isPrivate: true },
        })
      : await prisma.user.create({
          data: {
            email: seed.email,
            handle: seed.handle,
            name: seed.name,
            bio: seed.bio,
            password: passwordHash,
            emailVerifiedAt: verifiedAt,
            role: seed.role,
            status: AccountStatus.ACTIVE,
            isPrivate: seed.isPrivate,
          },
          select: { id: true, email: true, handle: true, role: true, isPrivate: true },
        });

    await prisma.$transaction([
      prisma.staffRecoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);

    console.log('Seeded preview test user:', {
      email: user.email,
      handle: user.handle,
      role: user.role,
      isPrivate: user.isPrivate,
    });
  }
}

run()
  .catch((error) => {
    console.error('Failed to seed preview test users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
