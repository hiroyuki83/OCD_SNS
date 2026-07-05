import Image from "next/image";
import Link from "next/link";
import { Bell, Bookmark, ClipboardCheck, Gavel, Home, LogOut, Pencil, Search, Settings, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/auth";
import MobileMenu from "@/components/layout/MobileMenu";
import NotificationsLink from "@/components/layout/NotificationsLink";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

const LABEL_HOME = "ホーム";
const LABEL_TEST = "心理検査";
const LABEL_NOTIFICATIONS = "通知";
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
      unreadNotifications = await prisma.notification.count({
        where: { userId: resolvedUserId, readAt: null },
      });
    }
  }
  const navItems = [
    { label: LABEL_HOME, icon: Home, iconKey: "home", href: "/" },
    { label: LABEL_TEST, icon: ClipboardCheck, iconKey: "test", href: "/test" },
    { label: LABEL_NOTIFICATIONS, icon: Bell, iconKey: "notifications", href: "/notifications" },
    { label: LABEL_SEARCH, icon: Search, iconKey: "search", href: "/explore" },
    { label: LABEL_BOOKMARKS, icon: Bookmark, iconKey: "bookmarks", href: "/bookmarks" },
    { label: LABEL_PROFILE, icon: User, iconKey: "profile", href: "/profile" },
  ] as const;

  const isAdmin = role === Role.ADMIN;
  const isModerator = role === Role.MODERATOR || isAdmin;
  const adminItems = [
    ...(isModerator ? [{ label: LABEL_MODERATION, icon: Gavel, iconKey: "moderation" as const, href: "/moderation" }] : []),
    ...(isAdmin ? [{ label: LABEL_ADMIN, icon: Shield, iconKey: "admin" as const, href: "/admin" }] : []),
  ] as const;
  const allNavItems = [...navItems, ...adminItems];

  return (
    <>
      <MobileMenu
        navItems={allNavItems.map(({ label, href, iconKey }) => ({ label, href, iconKey }))}
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

      <div className="hidden lg:flex flex-col justify-between h-screen w-[275px] px-2 sticky top-0 border-r border-border max-xl:w-20">
        <div className="flex flex-col gap-2 mt-1">
          <Link
            href="/"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
          >
            <Image
              src="/icon/logo.png"
              alt="Logo"
              width={56}
              height={56}
              className="h-full w-full rounded-full object-cover"
              priority
            />
          </Link>
          <nav className="flex flex-col gap-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                item.iconKey === "notifications" ? (
                  <NotificationsLink
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
                    label={item.label}
                    unread={unreadNotifications}
                    labelClassName="text-xl font-normal hidden xl:block"
                    icon={<Icon className="app-nav-icon text-zinc-900" />}
                  />
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="relative">
                      <Icon className="app-nav-icon text-zinc-900" />
                    </span>
                    <span className="text-xl font-normal hidden xl:block">{item.label}</span>
                  </Link>
                )
              );
            })}
          </nav>
          <Link
            href="/?compose=1"
            className="group flex items-center gap-4 p-3 w-fit rounded-full bg-[#1d9bf0] hover:bg-[#1a8cd8] transition-colors mt-4 mx-auto xl:mx-0"
            aria-label={LABEL_POST}
          >
            <Pencil className="app-compose-icon text-white" />
            <span className="text-xl font-normal text-white hidden xl:block">{LABEL_POST}</span>
          </Link>
        </div>

        <div className="mb-4">
          <div className="px-2 mb-2">
            <Link
              href="/settings"
              className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="app-nav-icon text-zinc-900" />
              <span className="text-xl font-normal hidden xl:block">{LABEL_SETTINGS}</span>
            </Link>
          </div>
          {session?.user ? (
            <div className="flex items-center justify-between gap-2">
              <button className="flex items-center gap-3 p-3 flex-1 rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors text-left overflow-hidden">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="プロフィール画像"
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0"></div>
                )}
                <div className="flex-1 hidden xl:block overflow-hidden">
                  <p className="font-bold text-sm truncate">{userProfile?.name ?? session.user.name}</p>
                  <p className="text-zinc-500 text-sm truncate">{userProfile?.email ?? session.user.email}</p>
                </div>
              </button>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-red-500 hidden xl:flex"
                  aria-label={LABEL_LOGOUT}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              <Link href="/login">
                <Button variant="outline" className="w-full rounded-full font-bold">
                  {LABEL_LOGIN}
                </Button>
              </Link>
              <Link href="/register">
                <Button className="w-full rounded-full font-bold bg-white text-black hover:bg-zinc-200">
                  {LABEL_REGISTER}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

