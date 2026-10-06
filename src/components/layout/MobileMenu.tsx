'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { LogOut, Pencil } from 'lucide-react';
import { signOut } from 'next-auth/react';
import SidebarNavItem, {
    type NavigationIconKey,
} from '@/components/layout/SidebarNavItem';

type NavItem = {
    label: string;
    href: string;
    iconKey: NavigationIconKey;
};

type Labels = {
    post: string;
    settings: string;
    login: string;
    register: string;
    logout: string;
};

type UserInfo = {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
} | null;

export default function MobileMenu({
    navItems,
    user,
    labels,
    unreadNotifications = 0,
}: {
    navItems: NavItem[];
    user: UserInfo;
    labels: Labels;
    unreadNotifications?: number;
}) {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    const toggle = () => setOpen((prev) => !prev);

    return (
        <div className="sticky top-0 z-40 border-b border-border bg-white lg:hidden">
            <div className="flex h-14 items-center px-3">
                <button
                    type="button"
                    onClick={toggle}
                    className="flex h-11 items-center gap-2 rounded-xl pr-3 transition-colors hover:bg-zinc-100"
                    aria-expanded={open}
                    aria-controls="mobile-nav-panel"
                    aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
                >
                    <span className="flex h-11 w-11 items-center justify-center">
                        <Image
                            src="/icon/logo.png"
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                            priority
                        />
                    </span>
                    <span className="text-sm font-medium text-zinc-600">メニュー</span>
                </button>
            </div>

            {open && (
                <div className="fixed inset-0 z-40">
                    <button
                        type="button"
                        onClick={close}
                        className="absolute inset-0 bg-black/30"
                        aria-label="メニューを閉じる"
                    />

                    <aside
                        id="mobile-nav-panel"
                        className="absolute left-0 top-0 flex h-full w-72 flex-col justify-between overflow-y-auto border-r border-border bg-white p-3 shadow-xl"
                    >
                        <div>
                            <Link
                                href="/"
                                onClick={close}
                                className="mb-3 flex h-12 items-center gap-3 rounded-xl px-1 transition-colors hover:bg-zinc-100"
                            >
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                                    <Image
                                        src="/icon/logo.png"
                                        alt=""
                                        width={44}
                                        height={44}
                                        className="h-11 w-11 rounded-full object-cover"
                                        priority
                                    />
                                </span>
                                <span className="text-base font-semibold text-zinc-900">CoCo</span>
                            </Link>

                            <nav aria-label="主要ナビゲーション" className="flex flex-col gap-1">
                                {navItems.map((item) => (
                                    <SidebarNavItem
                                        key={item.href}
                                        {...item}
                                        unread={
                                            item.iconKey === 'notifications'
                                                ? unreadNotifications
                                                : 0
                                        }
                                        mobile
                                        onNavigate={close}
                                    />
                                ))}
                            </nav>

                            <Link
                                href="/?compose=1"
                                onClick={close}
                                className="mt-3 flex h-12 w-full items-center rounded-full bg-sky-500 transition-colors hover:bg-sky-600"
                                aria-label={labels.post}
                            >
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                                    <Pencil
                                        className="h-6 w-6 shrink-0 badge-text-white"
                                        strokeWidth={2}
                                    />
                                </span>
                                <span className="text-[15px] font-semibold badge-text-white">
                                    {labels.post}
                                </span>
                            </Link>
                        </div>

                        <div className="mt-6 border-t border-zinc-100 pt-3">
                            {user && (
                                <div className="mb-2 flex min-h-14 items-center rounded-xl bg-zinc-50 px-1">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                                        {user.avatarUrl ? (
                                            <img
                                                src={user.avatarUrl}
                                                alt="プロフィール画像"
                                                className="h-9 w-9 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="h-9 w-9 rounded-full bg-slate-300" />
                                        )}
                                    </span>
                                    <div className="min-w-0 flex-1 pr-2">
                                        <p className="truncate text-sm font-semibold text-zinc-900">
                                            {user.name}
                                        </p>
                                        <p className="truncate text-xs text-zinc-500">{user.email}</p>
                                    </div>
                                </div>
                            )}

                            <SidebarNavItem
                                label={labels.settings}
                                href="/settings"
                                iconKey="settings"
                                mobile
                                onNavigate={close}
                            />

                            {user ? (
                                <button
                                    type="button"
                                    className="group flex h-12 w-full items-center rounded-xl text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600"
                                    onClick={() => {
                                        close();
                                        signOut({ callbackUrl: '/' });
                                    }}
                                >
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                                        <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.9} />
                                    </span>
                                    <span className="text-[15px] font-medium">{labels.logout}</span>
                                </button>
                            ) : (
                                <div className="mt-3 flex flex-col gap-2">
                                    <Link
                                        href="/login"
                                        onClick={close}
                                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                                    >
                                        {labels.login}
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={close}
                                        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold badge-text-white hover:bg-zinc-800"
                                    >
                                        {labels.register}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
