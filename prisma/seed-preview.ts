import bcrypt from 'bcryptjs';
import { AccountStatus, PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validatePreviewSeedSafety } from '../src/lib/previewSafety';

const safety = validatePreviewSeedSafety({
  vercelEnv: process.env.VERCEL_ENV,
  gitRef: process.env.VERCEL_GIT_COMMIT_REF,
  seedUsers: process.env.PREVIEW_SEED_USERS,
  databaseUrl: process.env.DATABASE_URL,
  previewDatabaseUrl: process.env.PREVIEW_DATABASE_URL,
  testPassword: process.env.PREVIEW_TEST_PASSWORD,
});

if (!safety.ok) {
  console.error(safety.error);
  process.exit(1);
}

const previewDatabaseUrl = safety.previewDatabaseUrl;
const password = safety.testPassword;

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
  {
    email: 'coco.preview.moderator2@example.com',
    handle: 'preview-moderator-2',
    name: 'Preview Moderator 2',
    role: Role.MODERATOR,
    isPrivate: false,
    bio: 'E2E分離用のモデレーターです。',
  },
  {
    email: 'coco.preview.admin2@example.com',
    handle: 'preview-admin-2',
    name: 'Preview Admin 2',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'E2E分離用の管理者です。',
  },
  {
    email: 'coco.preview.admin3@example.com',
    handle: 'preview-admin-3',
    name: 'Preview Admin 3',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'E2E管理操作分離用の管理者です。',
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
