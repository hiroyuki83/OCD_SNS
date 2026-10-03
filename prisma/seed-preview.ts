import bcrypt from 'bcryptjs';
import {
  AccountStatus,
  NotificationType,
  PrismaClient,
  ReactionType,
  Role,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validatePreviewSeedSafety } from '../src/lib/previewSafety';

const safety = validatePreviewSeedSafety({
  vercelEnv: process.env.VERCEL_ENV,
  gitRef: process.env.VERCEL_GIT_COMMIT_REF,
  seedUsers: process.env.PREVIEW_SEED_USERS,
  databaseUrl: process.env.DATABASE_URL,
  previewDatabaseUrl: process.env.PREVIEW_DATABASE_URL,
  testPassword: process.env.PREVIEW_TEST_PASSWORD,
  e2eMode: process.env.E2E_BLOB_MODE,
});

if (!safety.ok) {
  console.error(safety.error);
  process.exit(1);
}

const previewDatabaseUrl = safety.previewDatabaseUrl;
const password = safety.testPassword;
const isIsolatedE2E = process.env.E2E_BLOB_MODE?.trim() === '1';

const E2E_PROFILE_OVERRIDES: Record<string, { name: string; bio: string }> = {
  'coco.preview.public1@example.com': {
    name: 'Preview 公開ユーザー1',
    bio: 'Preview環境の公開テストユーザーです。',
  },
  'coco.preview.public2@example.com': {
    name: 'Preview 公開ユーザー2',
    bio: 'フォロー・通知・ブロック確認用の公開テストユーザーです。',
  },
  'coco.preview.appeal@example.com': {
    name: 'Preview Appeal User',
    bio: 'E2E処分異議申立て専用ユーザーです。',
  },
  'coco.preview.private@example.com': {
    name: 'Preview 非公開ユーザー',
    bio: '非公開アカウントとフォロー申請の確認用です。',
  },
  'coco.preview.moderator@example.com': {
    name: 'Preview Moderator',
    bio: 'Preview環境のモデレーター確認用です。',
  },
  'coco.preview.admin@example.com': {
    name: 'Preview Admin',
    bio: 'Preview環境の管理者確認用です。',
  },
  'coco.preview.moderator2@example.com': {
    name: 'Preview Moderator 2',
    bio: 'E2E分離用のモデレーターです。',
  },
  'coco.preview.admin2@example.com': {
    name: 'Preview Admin 2',
    bio: 'E2E分離用の管理者です。',
  },
  'coco.preview.admin3@example.com': {
    name: 'Preview Admin 3',
    bio: 'E2E管理操作分離用の管理者です。',
  },
  'coco.preview.admin4@example.com': {
    name: 'Preview Admin 4',
    bio: 'E2E処分発行用の管理者です。',
  },
  'coco.preview.admin5@example.com': {
    name: 'Preview Admin 5',
    bio: 'E2E処分異議申立て審査用の管理者です。',
  },
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: previewDatabaseUrl }),
});

const TEST_USERS = [
  {
    email: 'coco.preview.public1@example.com',
    handle: 'preview-public-1',
    name: 'みさき',
    role: Role.USER,
    isPrivate: false,
    bio: 'ゆっくり生活を整え中。散歩とコーヒーが好きです。',
    autoHashtag: 'セルフケア',
    avatarUrl: '/preview-demo/avatars/misaki.svg',
    headerUrl: '/preview-demo/headers/morning.svg',
  },
  {
    email: 'coco.preview.public2@example.com',
    handle: 'preview-public-2',
    name: 'はる',
    role: Role.USER,
    isPrivate: false,
    bio: '頑張りすぎない練習中。できたことを少しずつ。',
    autoHashtag: '生活リズム',
    avatarUrl: '/preview-demo/avatars/haru.svg',
    headerUrl: '/preview-demo/headers/calm.svg',
  },
  {
    email: 'coco.preview.appeal@example.com',
    handle: 'preview-appeal-user',
    name: 'さくら',
    role: Role.USER,
    isPrivate: false,
    bio: '調子の波と付き合いながら、日々のことを書いています。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/sakura.svg',
    headerUrl: '/preview-demo/headers/sunset.svg',
  },
  {
    email: 'coco.preview.private@example.com',
    handle: 'preview-private',
    name: 'ゆう',
    role: Role.USER,
    isPrivate: true,
    bio: 'ここでは少し静かに過ごしています。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/yuu.svg',
    headerUrl: '/preview-demo/headers/private.svg',
  },
  {
    email: 'coco.preview.moderator@example.com',
    handle: 'preview-moderator',
    name: 'CoCo モデレーター',
    role: Role.MODERATOR,
    isPrivate: false,
    bio: 'CoCo運営チームです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/moderator.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.admin@example.com',
    handle: 'preview-admin',
    name: 'CoCo 運営',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'CoCo運営アカウントです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/admin.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.moderator2@example.com',
    handle: 'preview-moderator-2',
    name: 'CoCo モデレーター2',
    role: Role.MODERATOR,
    isPrivate: false,
    bio: 'CoCo運営チームです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/moderator2.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.admin2@example.com',
    handle: 'preview-admin-2',
    name: 'CoCo 運営2',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'CoCo運営アカウントです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/admin2.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.admin3@example.com',
    handle: 'preview-admin-3',
    name: 'CoCo 運営3',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'CoCo運営アカウントです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/admin3.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.admin4@example.com',
    handle: 'preview-admin-4',
    name: 'CoCo 運営4',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'CoCo運営アカウントです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/admin4.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
  {
    email: 'coco.preview.admin5@example.com',
    handle: 'preview-admin-5',
    name: 'CoCo 運営5',
    role: Role.ADMIN,
    isPrivate: false,
    bio: 'CoCo運営アカウントです。',
    autoHashtag: null,
    avatarUrl: '/preview-demo/avatars/admin5.svg',
    headerUrl: '/preview-demo/headers/staff.svg',
  },
] as const;

const DEMO_POST_IDS = [
  'preview-demo-post-misaki-1',
  'preview-demo-post-misaki-2',
  'preview-demo-post-misaki-3',
  'preview-demo-post-haru-1',
  'preview-demo-post-haru-2',
  'preview-demo-post-yuu-1',
  'preview-demo-post-sakura-1',
  'preview-demo-post-admin-1',
] as const;

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000);

async function run() {
  const passwordHash = await bcrypt.hash(password, 10);
  const verifiedAt = new Date();
  const usersByEmail = new Map<string, { id: string; email: string }>();

  for (const seed of TEST_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: seed.email },
      select: { id: true },
    });

    const e2eProfile = E2E_PROFILE_OVERRIDES[seed.email];
    const data = {
      email: seed.email,
      handle: seed.handle,
      name: isIsolatedE2E ? (e2eProfile?.name ?? seed.name) : seed.name,
      bio: isIsolatedE2E ? (e2eProfile?.bio ?? seed.bio) : seed.bio,
      avatarUrl: isIsolatedE2E ? null : seed.avatarUrl,
      headerUrl: isIsolatedE2E ? null : seed.headerUrl,
      autoHashtag: isIsolatedE2E ? null : seed.autoHashtag,
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
    };

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...data,
            sessionVersion: { increment: 1 },
          },
          select: { id: true, email: true, handle: true, role: true, isPrivate: true },
        })
      : await prisma.user.create({
          data,
          select: { id: true, email: true, handle: true, role: true, isPrivate: true },
        });

    usersByEmail.set(user.email, { id: user.id, email: user.email });

    await prisma.$transaction([
      prisma.appeal.deleteMany({ where: { userId: user.id } }),
      prisma.sanction.deleteMany({ where: { targetUserId: user.id } }),
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

  if (isIsolatedE2E) {
    console.log('Seeded isolated E2E users without Preview demo community data.');
    return;
  }

  const userId = (email: string) => {
    const user = usersByEmail.get(email);
    if (!user) throw new Error(`Preview seed user missing: ${email}`);
    return user.id;
  };

  const public1Id = userId('coco.preview.public1@example.com');
  const public2Id = userId('coco.preview.public2@example.com');
  const privateId = userId('coco.preview.private@example.com');
  const appealId = userId('coco.preview.appeal@example.com');
  const adminId = userId('coco.preview.admin@example.com');
  const testUserIds = [...usersByEmail.values()].map((user) => user.id);

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: {
        userId: { in: testUserIds },
        actorId: { in: testUserIds },
      },
    }),
    prisma.follow.deleteMany({
      where: {
        followerId: { in: testUserIds },
        followingId: { in: testUserIds },
      },
    }),
    prisma.like.deleteMany({
      where: {
        userId: { in: testUserIds },
        postId: { in: [...DEMO_POST_IDS] },
      },
    }),
    prisma.bookmark.deleteMany({
      where: {
        userId: { in: testUserIds },
        postId: { in: [...DEMO_POST_IDS] },
      },
    }),
    prisma.reaction.deleteMany({
      where: {
        userId: { in: testUserIds },
        postId: { in: [...DEMO_POST_IDS] },
      },
    }),
  ]);

  const demoPosts = [
    {
      id: 'preview-demo-post-misaki-1',
      authorId: public1Id,
      content: '今日は朝に10分だけ散歩できた。小さくても、できたことを残しておく。 #セルフケア',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(1),
    },
    {
      id: 'preview-demo-post-misaki-2',
      authorId: public1Id,
      content: '気分が落ちている日は、全部を立て直そうとしないで「今日はこれだけ」にしてみる。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(5),
    },
    {
      id: 'preview-demo-post-misaki-3',
      authorId: public1Id,
      content: '夕方の空がきれいだったので一枚。こういう小さい瞬間は覚えておきたい。 #今日よかったこと',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(18),
    },
    {
      id: 'preview-demo-post-haru-1',
      authorId: public2Id,
      content: '予定を詰めすぎない日を作る練習中。休む時間も予定に入れてみた。 #生活リズム',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(2),
    },
    {
      id: 'preview-demo-post-haru-2',
      authorId: public2Id,
      content: '眠れなかった翌日は、いつも通りにできなくてもいいことにする。今日はゆっくり。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(10),
    },
    {
      id: 'preview-demo-post-yuu-1',
      authorId: privateId,
      content: '今日は少し静かに過ごしたい日。無理に元気にならなくてもいいかなと思ってる。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(4),
    },
    {
      id: 'preview-demo-post-sakura-1',
      authorId: appealId,
      content: '調子に波があると、昨日できたことが今日できない日もある。それでも一日ずつ。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(7),
    },
    {
      id: 'preview-demo-post-admin-1',
      authorId: adminId,
      content: 'CoCo Previewへようこそ。ここは機能や使い心地を確認するためのテスト環境です。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(24),
    },
  ] as const;

  for (const post of demoPosts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: {
        authorId: post.authorId,
        content: post.content,
        imageUrl: post.imageUrl,
        imageAlt: post.imageAlt,
        createdAt: post.createdAt,
        deletedAt: null,
        deletedById: null,
        isHidden: false,
        hiddenAt: null,
        hiddenReason: null,
        hiddenById: null,
        wakaruCount: 0,
        ganbattaCount: 0,
      },
      create: {
        ...post,
        wakaruCount: 0,
        ganbattaCount: 0,
      },
    });
  }

  await prisma.follow.createMany({
    data: [
      {
        id: 'preview-demo-follow-public1-public2',
        followerId: public1Id,
        followingId: public2Id,
        acceptedAt: hoursAgo(30),
      },
      {
        id: 'preview-demo-follow-public2-public1',
        followerId: public2Id,
        followingId: public1Id,
        acceptedAt: hoursAgo(28),
      },
      {
        id: 'preview-demo-follow-public2-private',
        followerId: public2Id,
        followingId: privateId,
        acceptedAt: hoursAgo(20),
      },
      {
        id: 'preview-demo-follow-public1-private-pending',
        followerId: public1Id,
        followingId: privateId,
        acceptedAt: null,
      },
      {
        id: 'preview-demo-follow-appeal-public1',
        followerId: appealId,
        followingId: public1Id,
        acceptedAt: hoursAgo(15),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.like.createMany({
    data: [
      {
        id: 'preview-demo-like-public2-misaki1',
        userId: public2Id,
        postId: 'preview-demo-post-misaki-1',
        createdAt: hoursAgo(0.75),
      },
      {
        id: 'preview-demo-like-public2-misaki3',
        userId: public2Id,
        postId: 'preview-demo-post-misaki-3',
        createdAt: hoursAgo(8),
      },
      {
        id: 'preview-demo-like-public1-haru1',
        userId: public1Id,
        postId: 'preview-demo-post-haru-1',
        createdAt: hoursAgo(1.5),
      },
      {
        id: 'preview-demo-like-private-misaki2',
        userId: privateId,
        postId: 'preview-demo-post-misaki-2',
        createdAt: hoursAgo(3),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.reaction.createMany({
    data: [
      {
        id: 'preview-demo-reaction-public2-misaki2-wakaru',
        userId: public2Id,
        postId: 'preview-demo-post-misaki-2',
        type: ReactionType.WAKARU,
        createdAt: hoursAgo(3.5),
      },
      {
        id: 'preview-demo-reaction-public1-haru1-ganbatta',
        userId: public1Id,
        postId: 'preview-demo-post-haru-1',
        type: ReactionType.GANBATTA,
        createdAt: hoursAgo(1.25),
      },
      {
        id: 'preview-demo-reaction-appeal-misaki1-wakaru',
        userId: appealId,
        postId: 'preview-demo-post-misaki-1',
        type: ReactionType.WAKARU,
        createdAt: hoursAgo(0.5),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.bookmark.createMany({
    data: [
      {
        id: 'preview-demo-bookmark-public1-haru1',
        userId: public1Id,
        postId: 'preview-demo-post-haru-1',
        createdAt: hoursAgo(1),
      },
      {
        id: 'preview-demo-bookmark-public2-misaki3',
        userId: public2Id,
        postId: 'preview-demo-post-misaki-3',
        createdAt: hoursAgo(6),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: [
      {
        id: 'preview-demo-notification-public1-like',
        type: NotificationType.LIKE,
        userId: public1Id,
        actorId: public2Id,
        postId: 'preview-demo-post-misaki-1',
        createdAt: hoursAgo(0.75),
      },
      {
        id: 'preview-demo-notification-public1-wakaru',
        type: NotificationType.WAKARU,
        userId: public1Id,
        actorId: appealId,
        postId: 'preview-demo-post-misaki-1',
        createdAt: hoursAgo(0.5),
      },
      {
        id: 'preview-demo-notification-public1-follow',
        type: NotificationType.FOLLOW,
        userId: public1Id,
        actorId: public2Id,
        postId: null,
        readAt: hoursAgo(12),
        createdAt: hoursAgo(28),
      },
      {
        id: 'preview-demo-notification-public2-ganbatta',
        type: NotificationType.GANBATTA,
        userId: public2Id,
        actorId: public1Id,
        postId: 'preview-demo-post-haru-1',
        createdAt: hoursAgo(1.25),
      },
      {
        id: 'preview-demo-notification-private-follow-request',
        type: NotificationType.FOLLOW,
        userId: privateId,
        actorId: public1Id,
        postId: null,
        createdAt: hoursAgo(0.25),
      },
    ],
    skipDuplicates: true,
  });

  for (const postId of DEMO_POST_IDS) {
    const [wakaruCount, ganbattaCount] = await Promise.all([
      prisma.reaction.count({
        where: { postId, type: ReactionType.WAKARU },
      }),
      prisma.reaction.count({
        where: { postId, type: ReactionType.GANBATTA },
      }),
    ]);
    await prisma.post.update({
      where: { id: postId },
      data: { wakaruCount, ganbattaCount },
    });
  }

  await prisma.announcement.upsert({
    where: { id: 'preview-demo-announcement-welcome' },
    update: {
      title: 'Preview環境へようこそ',
      body: 'プロフィール、投稿、フォロー、通知などのサンプルデータを入れています。実際のSNSに近い状態で操作感を確認できます。',
      href: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdById: adminId,
    },
    create: {
      id: 'preview-demo-announcement-welcome',
      title: 'Preview環境へようこそ',
      body: 'プロフィール、投稿、フォロー、通知などのサンプルデータを入れています。実際のSNSに近い状態で操作感を確認できます。',
      href: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdById: adminId,
    },
  });

  console.log('Seeded Preview demo community:', {
    users: TEST_USERS.length,
    demoPosts: demoPosts.length,
    relationships: 5,
    likes: 4,
    reactions: 3,
    bookmarks: 2,
    notifications: 5,
  });
}

run()
  .catch((error) => {
    console.error('Failed to seed Preview demo community:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
