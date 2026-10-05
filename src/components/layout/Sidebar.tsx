import Image from "next/image";
import Link from "next/link";
import { LogOut, Pencil } from "lucide-react";
import { auth, signOut } from "@/auth";
import MobileMenu from "@/components/layout/MobileMenu";
import SidebarNavItem, {
  type NavigationIconKey,
} from "@/components/layout/SidebarNavItem";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { visibleAccountFilter } from "@/lib/accountStatus";

const LABEL_HOME = "ホーム";
const LABEL_TEST = "セルフチェック";
const LABEL_NOTIFICATIONS = "通知";
const LABEL_SAFETY = "安全";
const LABEL_SEARCH = "検索";
const LABEL_BOOKMARKS = "ブックマーク";
const LABEL_PROFILE = "自分の投稿";
const LABEL_POST = "投稿する";
const LABEL_SETTINGS = "設定";
const LABEL_LOGIN = "ログイン";
const LABEL_REGISTER = "新規登録";
const LABEL_LOGOUT = "ログアウト";
const LABEL_ADMIN = "Admin";
const LABEL_MODERATION = "Moderation";

type NavItem = {
  label: string;
  iconKey: NavigationIconKey;
  href: string;
};

export default async function Sidebar() {
  const session = await auth();
  let userProfile: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null =
    session?.user ?? null;
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  let role: Role | null = (session?.user?.role as Role | undefined) ?? null;
  let unreadNotifications = 0;

  if (userId || userEmail) {
    const user = await prisma.user.findUnique({
      where: userId ? { id: userId } : { email: userEmail ?? "" },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });

    if (user) {
      userProfile = { name: user.name, email: user.email, avatarUrl: user.avatarUrl };
      role = user.role;
    }

    const resolvedUserId = userId ?? user?.id ?? null;
    if (resolvedUserId) {
      const [socialUnread, warningUnread] = await Promise.all([
        prisma.notification.count({
          where: {
            userId: resolvedUserId,
            readAt: null,
            actor: {
              AND: [
                visibleAccountFilter(new Date()),
                { blockedBy: { none: { blockerId: resolvedUserId } } },
                { blocksInitiated: { none: { blockedId: resolvedUserId } } },
                { mutedBy: { none: { muterId: resolvedUserId } } },
              ],
            },
            OR: [
              { type: "FOLLOW" },
              {
                post: {
                  is: {
                    deletedAt: null,
                    isHidden: false,
                  },
                },
              },
            ],
          },
        }),
        prisma.moderationWarning.count({
          where: { targetUserId: resolvedUserId, readAt: null },
        }),
      ]);
      unreadNotifications = socialUnread + warningUnread;
    }
  }

  const navItems: NavItem[] = [
    { label: LABEL_HOME, iconKey: "home", href: "/" },
    { label: LABEL_TEST, iconKey: "test", href: "/test" },
    { label: LABEL_NOTIFICATIONS, iconKey: "notifications", href: "/notifications" },
    { label: LABEL_SAFETY, iconKey: "safety", href: "/safety" },
    { label: LABEL_SEARCH, iconKey: "search", href: "/explore" },
    { label: LABEL_BOOKMARKS, iconKey: "bookmarks", href: "/bookmarks" },
    { label: LABEL_PROFILE, iconKey: "profile", href: "/profile" },
  ];

  const isAdmin = role === Role.ADMIN;
  const isModerator = role === Role.MODERATOR || isAdmin;

  if (isModerator) {
    navItems.push({ label: LABEL_MODERATION, iconKey: "moderation", href: "/moderation" });
  }
  if (isAdmin) {
    navItems.push({ label: LABEL_ADMIN, iconKey: "admin", href: "/admin" });
  }

  return (
    <>
      <MobileMenu
        navItems={navItems}
        user={userProfile}
        labels={{
          post: LABEL_POST,
          settings: LABEL_SETTINGS,
          login: LABEL_LOGIN,
          register: LABEL_REGISTER,
          logout: LABEL_LOGOUT,
        }}
        unreadNotifications={unreadNotifications}
      />

      <aside className="sticky top-0 hidden h-dvh max-h-dvh w-[260px] shrink-0 flex-col justify-between overflow-y-auto overscroll-contain border-r border-border bg-white px-3 py-2 lg:flex max-xl:w-[72px]">
        <div className="shrink-0">
          <Link
            href="/"
            className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-zinc-100"
            aria-label="CoCo ホーム"
            title="CoCo"
          >
            <Image
              src="/icon/logo.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              priority
            />
          </Link>

          <nav aria-label="主要ナビゲーション" className="flex flex-col gap-1">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                {...item}
                unread={item.iconKey === "notifications" ? unreadNotifications : 0}
              />
            ))}
          </nav>

          <Link
            href="/?compose=1"
            className="group mt-3 flex h-12 w-full items-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-600"
            aria-label={LABEL_POST}
            title={LABEL_POST}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center">
              <Pencil className="h-6 w-6 shrink-0 badge-text-white" strokeWidth={2} />
            </span>
            <span className="hidden truncate text-[15px] font-semibold badge-text-white xl:block">
              {LABEL_POST}
            </span>
          </Link>
        </div>

        <div className="shrink-0 border-t border-zinc-100 pt-2">
          {session?.user && (
            <div className="mb-1 flex h-14 w-full items-center overflow-hidden rounded-xl">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="プロフィール画像"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-9 w-9 rounded-full bg-slate-300" />
                )}
              </span>
              <div className="hidden min-w-0 flex-1 pr-2 xl:block">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {userProfile?.name ?? session.user.name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {userProfile?.email ?? session.user.email}
                </p>
              </div>
            </div>
          )}

          <SidebarNavItem
            label={LABEL_SETTINGS}
            href="/settings"
            iconKey="settings"
          />

          {session?.user ? (
            <form
              className="w-full"
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="group flex h-12 w-full items-center rounded-xl text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={LABEL_LOGOUT}
                title={LABEL_LOGOUT}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                  <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.9} />
                </span>
                <span className="hidden truncate text-[15px] font-medium xl:block">
                  {LABEL_LOGOUT}
                </span>
              </button>
            </form>
          ) : (
            <div className="mt-2 hidden flex-col gap-2 xl:flex">
              <Link
                href="/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {LABEL_LOGIN}
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold badge-text-white hover:bg-zinc-800"
              >
                {LABEL_REGISTER}
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
