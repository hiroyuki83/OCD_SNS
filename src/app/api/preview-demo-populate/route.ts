import { NextResponse } from 'next/server';
import { AccountStatus, NotificationType, ReactionType, Role } from '@prisma/client';

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'preview'
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  const anchor = await prisma.user.findUnique({
    where: { email: 'coco.preview.public1@example.com' },
    select: { password: true, emailVerifiedAt: true },
  });
  if (!anchor?.password) {
    throw new Error('Preview public1 anchor user is missing.');
  }

  const testUserDefinitions = [
    { email: 'coco.preview.public1@example.com', handle: 'preview-public-1', role: Role.USER, isPrivate: false },
    { email: 'coco.preview.public2@example.com', handle: 'preview-public-2', role: Role.USER, isPrivate: false },
    { email: 'coco.preview.private@example.com', handle: 'preview-private', role: Role.USER, isPrivate: true },
    { email: 'coco.preview.appeal@example.com', handle: 'preview-appeal-user', role: Role.USER, isPrivate: false },
    { email: 'coco.preview.moderator@example.com', handle: 'preview-moderator', role: Role.MODERATOR, isPrivate: false },
    { email: 'coco.preview.moderator2@example.com', handle: 'preview-moderator-2', role: Role.MODERATOR, isPrivate: false },
    { email: 'coco.preview.admin@example.com', handle: 'preview-admin', role: Role.ADMIN, isPrivate: false },
    { email: 'coco.preview.admin2@example.com', handle: 'preview-admin-2', role: Role.ADMIN, isPrivate: false },
    { email: 'coco.preview.admin3@example.com', handle: 'preview-admin-3', role: Role.ADMIN, isPrivate: false },
    { email: 'coco.preview.admin4@example.com', handle: 'preview-admin-4', role: Role.ADMIN, isPrivate: false },
    { email: 'coco.preview.admin5@example.com', handle: 'preview-admin-5', role: Role.ADMIN, isPrivate: false },
  ] as const;

  for (const seed of testUserDefinitions) {
    await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        handle: seed.handle,
        role: seed.role,
        isPrivate: seed.isPrivate,
        status: AccountStatus.ACTIVE,
      },
      create: {
        email: seed.email,
        handle: seed.handle,
        password: anchor.password,
        emailVerifiedAt: anchor.emailVerifiedAt ?? new Date(),
        role: seed.role,
        status: AccountStatus.ACTIVE,
        isPrivate: seed.isPrivate,
      },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { in: testUserDefinitions.map((seed) => seed.email) },
    },
    select: { id: true, email: true },
  });

  const byEmail = new Map(users.map((user) => [user.email, user.id]));
  const id = (email: string) => {
    const value = byEmail.get(email);
    if (!value) throw new Error(`Missing Preview test user after upsert: ${email}`);
    return value;
  };

  const public1Id = id('coco.preview.public1@example.com');
  const public2Id = id('coco.preview.public2@example.com');
  const privateId = id('coco.preview.private@example.com');
  const appealId = id('coco.preview.appeal@example.com');
  const adminId = id('coco.preview.admin@example.com');
  const testUserIds = [...byEmail.values()];

  const profileUpdates = [
    {
      email: 'coco.preview.public1@example.com',
      name: 'みさき',
      bio: 'ゆっくり生活を整え中。散歩とコーヒーが好きです。',
      autoHashtag: 'セルフケア',
      avatarUrl: '/preview-demo/avatars/misaki.svg',
      headerUrl: '/preview-demo/headers/morning.svg',
    },
    {
      email: 'coco.preview.public2@example.com',
      name: 'はる',
      bio: '頑張りすぎない練習中。できたことを少しずつ。',
      autoHashtag: '生活リズム',
      avatarUrl: '/preview-demo/avatars/haru.svg',
      headerUrl: '/preview-demo/headers/calm.svg',
    },
    {
      email: 'coco.preview.private@example.com',
      name: 'ゆう',
      bio: 'ここでは少し静かに過ごしています。',
      autoHashtag: null,
      avatarUrl: '/preview-demo/avatars/yuu.svg',
      headerUrl: '/preview-demo/headers/private.svg',
    },
    {
      email: 'coco.preview.appeal@example.com',
      name: 'さくら',
      bio: '調子の波と付き合いながら、日々のことを書いています。',
      autoHashtag: null,
      avatarUrl: '/preview-demo/avatars/sakura.svg',
      headerUrl: '/preview-demo/headers/sunset.svg',
    },
    {
      email: 'coco.preview.moderator@example.com',
      name: 'CoCo モデレーター',
      bio: 'CoCo運営チームです。',
      autoHashtag: null,
      avatarUrl: '/preview-demo/avatars/moderator.svg',
      headerUrl: '/preview-demo/headers/staff.svg',
    },
    {
      email: 'coco.preview.moderator2@example.com',
      name: 'CoCo モデレーター2',
      bio: 'CoCo運営チームです。',
      autoHashtag: null,
      avatarUrl: '/preview-demo/avatars/moderator2.svg',
      headerUrl: '/preview-demo/headers/staff.svg',
    },
    ...[1, 2, 3, 4, 5].map((n) => ({
      email: n === 1 ? 'coco.preview.admin@example.com' : `coco.preview.admin${n}@example.com`,
      name: n === 1 ? 'CoCo 運営' : `CoCo 運営${n}`,
      bio: 'CoCo運営アカウントです。',
      autoHashtag: null,
      avatarUrl:
        n === 1
          ? '/preview-demo/avatars/admin.svg'
          : `/preview-demo/avatars/admin${n}.svg`,
      headerUrl: '/preview-demo/headers/staff.svg',
    })),
  ];

  for (const profile of profileUpdates) {
    await prisma.user.update({
      where: { email: profile.email },
      data: {
        name: profile.name,
        bio: profile.bio,
        autoHashtag: profile.autoHashtag,
        avatarUrl: profile.avatarUrl,
        headerUrl: profile.headerUrl,
      },
    });
  }

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

  const posts = [
    {
      id: 'preview-demo-post-misaki-1',
      authorId: public1Id,
      content:
        '今日は朝に10分だけ散歩できた。小さくても、できたことを残しておく。 #セルフケア',
      imageUrl: '/preview-demo/posts/walk.svg',
      imageAlt: '朝の散歩道をイメージしたイラスト',
      createdAt: hoursAgo(1),
    },
    {
      id: 'preview-demo-post-misaki-2',
      authorId: public1Id,
      content:
        '気分が落ちている日は、全部を立て直そうとしないで「今日はこれだけ」にしてみる。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(5),
    },
    {
      id: 'preview-demo-post-misaki-3',
      authorId: public1Id,
      content:
        '夕方の空がきれいだったので一枚。こういう小さい瞬間は覚えておきたい。 #今日よかったこと',
      imageUrl: '/preview-demo/posts/sky.svg',
      imageAlt: '夕方の空をイメージしたイラスト',
      createdAt: hoursAgo(18),
    },
    {
      id: 'preview-demo-post-haru-1',
      authorId: public2Id,
      content:
        '予定を詰めすぎない日を作る練習中。休む時間も予定に入れてみた。 #生活リズム',
      imageUrl: '/preview-demo/posts/desk.svg',
      imageAlt: 'ノートとマグカップのある机をイメージしたイラスト',
      createdAt: hoursAgo(2),
    },
    {
      id: 'preview-demo-post-haru-2',
      authorId: public2Id,
      content:
        '眠れなかった翌日は、いつも通りにできなくてもいいことにする。今日はゆっくり。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(10),
    },
    {
      id: 'preview-demo-post-yuu-1',
      authorId: privateId,
      content:
        '今日は少し静かに過ごしたい日。無理に元気にならなくてもいいかなと思ってる。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(4),
    },
    {
      id: 'preview-demo-post-sakura-1',
      authorId: appealId,
      content:
        '調子に波があると、昨日できたことが今日できない日もある。それでも一日ずつ。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(7),
    },
    {
      id: 'preview-demo-post-admin-1',
      authorId: adminId,
      content:
        'CoCo Previewへようこそ。ここは機能や使い心地を確認するためのテスト環境です。',
      imageUrl: null,
      imageAlt: null,
      createdAt: hoursAgo(24),
    },
  ] as const;

  for (const post of posts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: {
        ...post,
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
      { id: 'preview-demo-like-public2-misaki1', userId: public2Id, postId: 'preview-demo-post-misaki-1' },
      { id: 'preview-demo-like-public2-misaki3', userId: public2Id, postId: 'preview-demo-post-misaki-3' },
      { id: 'preview-demo-like-public1-haru1', userId: public1Id, postId: 'preview-demo-post-haru-1' },
      { id: 'preview-demo-like-private-misaki2', userId: privateId, postId: 'preview-demo-post-misaki-2' },
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
      },
      {
        id: 'preview-demo-reaction-public1-haru1-ganbatta',
        userId: public1Id,
        postId: 'preview-demo-post-haru-1',
        type: ReactionType.GANBATTA,
      },
      {
        id: 'preview-demo-reaction-appeal-misaki1-wakaru',
        userId: appealId,
        postId: 'preview-demo-post-misaki-1',
        type: ReactionType.WAKARU,
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
      },
      {
        id: 'preview-demo-bookmark-public2-misaki3',
        userId: public2Id,
        postId: 'preview-demo-post-misaki-3',
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
      },
      {
        id: 'preview-demo-notification-public1-wakaru',
        type: NotificationType.WAKARU,
        userId: public1Id,
        actorId: appealId,
        postId: 'preview-demo-post-misaki-1',
      },
      {
        id: 'preview-demo-notification-public1-follow',
        type: NotificationType.FOLLOW,
        userId: public1Id,
        actorId: public2Id,
        postId: null,
        readAt: hoursAgo(12),
      },
      {
        id: 'preview-demo-notification-public2-ganbatta',
        type: NotificationType.GANBATTA,
        userId: public2Id,
        actorId: public1Id,
        postId: 'preview-demo-post-haru-1',
      },
      {
        id: 'preview-demo-notification-private-follow-request',
        type: NotificationType.FOLLOW,
        userId: privateId,
        actorId: public1Id,
        postId: null,
      },
    ],
    skipDuplicates: true,
  });

  for (const postId of DEMO_POST_IDS) {
    const [wakaruCount, ganbattaCount] = await Promise.all([
      prisma.reaction.count({ where: { postId, type: ReactionType.WAKARU } }),
      prisma.reaction.count({ where: { postId, type: ReactionType.GANBATTA } }),
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
      body:
        'プロフィール、投稿、フォロー、通知などのサンプルデータを入れています。実際のSNSに近い状態で操作感を確認できます。',
      href: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdById: adminId,
    },
    create: {
      id: 'preview-demo-announcement-welcome',
      title: 'Preview環境へようこそ',
      body:
        'プロフィール、投稿、フォロー、通知などのサンプルデータを入れています。実際のSNSに近い状態で操作感を確認できます。',
      href: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdById: adminId,
    },
  });

  return NextResponse.json({
    ok: true,
    usersUpdated: profileUpdates.length,
    posts: posts.length,
    follows: 5,
    likes: 4,
    reactions: 3,
    bookmarks: 2,
    notifications: 5,
  });
}
