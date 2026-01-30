'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import NotificationsLink from '@/components/layout/NotificationsLink';
import {
    Bell,
    Bookmark,
    ClipboardCheck,
    Gavel,
    Home,
    LogOut,
    Pencil,
    Search,
    Settings,
    Shield,
    User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';

const iconMap = {
    home: Home,
    test: ClipboardCheck,
    notifications: Bell,
    search: Search,
    bookmarks: Bookmark,
    profile: User,
    moderation: Gavel,
    admin: Shield,
};

type IconKey = keyof typeof iconMap;

type NavItem = {
    label: string;
    href: string;
    iconKey: IconKey;
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
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-border">
            <div className="px-3 py-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-2"
                    aria-expanded={open}
                    aria-controls="mobile-nav-panel"
                >
                    <Image
                        src="/icon/logo.png"
                        alt="Menu"
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                        priority
                    />
                    <span className="text-sm text-zinc-500">繝｡繝九Η繝ｼ</span>
                </button>
            </div>
            {open && (
                <div className="fixed inset-0 z-40">
                    <button
                        type="button"
                        onClick={close}
                        className="absolute inset-0 bg-black/30"
                        aria-label="Close menu"
                    />
                    <div
                        id="mobile-nav-panel"
                        className="absolute left-0 top-0 h-full w-72 bg-white border-r border-border p-2 overflow-y-auto"
                    >
                        <div className="flex flex-col gap-2 mt-1">
                            <Link
                                href="/"
                                onClick={close}
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
                                {navItems.map((item) => {
                                    const Icon = iconMap[item.iconKey];
                                    return (
                                        item.iconKey === 'notifications' ? (
                                            <NotificationsLink
                                                key={item.label}
                                                href={item.href}
                                                className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
                                                label={item.label}
                                                unread={unreadNotifications}
                                                onNavigate={close}
                                                icon={<Icon className="app-nav-icon text-zinc-900" />}
                                            />
                                        ) : (
                                            <Link
                                                key={item.label}
                                                href={item.href}
                                                onClick={close}
                                                className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <span className="relative">
                                                    <Icon className="app-nav-icon text-zinc-900" />
                                                </span>
                                                <span className="text-xl font-normal">{item.label}</span>
                                            </Link>
                                        )
                                    );
                                })}
                            </nav>
                            <Link
                                href="/?compose=1"
                                onClick={close}
                                className="group flex items-center gap-4 p-3 w-fit rounded-full bg-[#1d9bf0] hover:bg-[#1a8cd8] transition-colors mt-4"
                                aria-label={labels.post}
                            >
                                <Pencil className="app-compose-icon text-white" />
                                <span className="text-xl font-normal text-white">{labels.post}</span>
                            </Link>
                        </div>

                        <div className="mb-4 mt-6">
                            <div className="px-2 mb-2">
                                <Link
                                    href="/settings"
                                    onClick={close}
                                    className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <Settings className="app-nav-icon text-zinc-900" />
                                    <span className="text-xl font-normal">{labels.settings}</span>
                                </Link>
                            </div>
                            {user ? (
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        className="flex items-center gap-3 p-3 flex-1 rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors text-left overflow-hidden"
                                    >
                                        {user.avatarUrl ? (
                                            <img
                                                src={user.avatarUrl}
                                                alt="プロフィール画像"
                                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0"></div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-bold text-sm truncate">{user.name}</p>
                                            <p className="text-zinc-500 text-sm truncate">{user.email}</p>
                                        </div>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-zinc-500 hover:text-red-500"
                                        aria-label={labels.logout}
                                        onClick={() => {
                                            close();
                                            signOut({ callbackUrl: '/' });
                                        }}
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-2">
                                    <Link href="/login" onClick={close}>
                                        <Button variant="outline" className="w-full rounded-full font-bold">
                                            {labels.login}
                                        </Button>
                                    </Link>
                                    <Link href="/register" onClick={close}>
                                        <Button className="w-full rounded-full font-bold bg-white text-black hover:bg-zinc-200">
                                            {labels.register}
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

