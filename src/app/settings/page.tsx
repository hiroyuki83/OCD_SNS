import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import ProfileEditForm from '@/components/profile/ProfileEditForm';
import FontSizeSetting from '@/components/settings/FontSizeSetting';
import StaffTotpSetting from '@/components/settings/StaffTotpSetting';
import SessionSecuritySetting from '@/components/settings/SessionSecuritySetting';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { mfa?: string };
}) {
  const session = await auth();
  let userId = session?.user?.id ?? null;
  if (!userId && session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  if (!session?.user || !userId) {
    return (
      <div className="min-h-screen border-r border-border">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
          <h1 className="font-bold text-base">設定</h1>
        </div>
        <div className="p-6 text-sm text-zinc-400">
          ログインすると設定が使えます。{' '}
          <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link>
          してください。
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      bio: true,
      email: true,
      autoHashtag: true,
      role: true,
      staffTotpEnabledAt: true,
      emailVerifiedAt: true,
      isPrivate: true,
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen border-r border-border">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
          <h1 className="font-bold text-base">設定</h1>
        </div>
        <div className="p-6 text-sm text-zinc-500">
          アカウント情報を取得できませんでした。{' '}
          <Link href="/login" className="text-[#1d9bf0] hover:underline">
            ログインし直す
          </Link>
          ことをお試しください。
        </div>
      </div>
    );
  }

  const isStaff = user.role === Role.ADMIN || user.role === Role.MODERATOR;
  const unusedRecoveryCodeCount = isStaff
    ? await prisma.staffRecoveryCode.count({
        where: { userId, usedAt: null },
      })
    : 0;

  return (
    <div className="min-h-screen border-r border-border">
      <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
        <h1 className="font-bold text-base">設定</h1>
      </div>
      <div className="p-6">
        {searchParams?.mfa === 'required' && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            ADMIN / MODERATORとして管理機能を使うには、スタッフ2段階認証の設定が必要です。
          </div>
        )}
        <FontSizeSetting />
        <SessionSecuritySetting />
        <ProfileEditForm name={user.name} bio={user.bio} autoHashtag={user.autoHashtag} />
        {isStaff && (
          <StaffTotpSetting
            enabled={Boolean(user.staffTotpEnabledAt)}
            unusedRecoveryCodeCount={unusedRecoveryCodeCount}
          />
        )}
        <div className="mt-6 rounded-lg border border-border p-4 text-xs text-zinc-600">
          <div>メール: {user.email ?? '-'}</div>
          <div className="mt-1">
            メール確認: {user.emailVerifiedAt ? '確認済み' : '未確認'}
          </div>
          <div className="mt-1">
            公開設定: {user.isPrivate ? '非公開アカウント' : '公開アカウント'}
          </div>
          <div className="mt-1">権限: {user.role}</div>
        </div>
      </div>
    </div>
  );
}
