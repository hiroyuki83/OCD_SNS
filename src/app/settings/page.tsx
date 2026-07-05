import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import ProfileEditForm from '@/components/profile/ProfileEditForm';
import FontSizeSetting from '@/components/settings/FontSizeSetting';

export default async function SettingsPage() {
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
        select: { name: true, bio: true, email: true, autoHashtag: true },
    });

  return (
    <div className="min-h-screen border-r border-border">
      <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
        <h1 className="font-bold text-base">設定</h1>
      </div>
      <div className="p-6">
        <FontSizeSetting />
        <ProfileEditForm name={user?.name} bio={user?.bio} autoHashtag={user?.autoHashtag} />
        <div className="mt-4 text-xs text-zinc-500">
          メール: {user?.email ?? '-'}
        </div>
      </div>
    </div>
  );
}
