'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    Bell,
    Bookmark,
    ClipboardCheck,
    Gavel,
    HeartHandshake,
    Home,
    Search,
    Settings,
    Shield,
    User,
} from 'lucide-react';

const iconMap = {
    home: Home,
    test: ClipboardCheck,
    notifications: Bell,
    safety: HeartHandshake,
    search: Search,
    bookmarks: Bookmark,
    profile: User,
    settings: Settings,
    moderation: Gavel,
    admin: Shield,
};

export type NavigationIconKey = keyof typeof iconMap;

export default function SidebarNavItem({
    label,
    href,
    iconKey,
    unread = 0,
    mobile = false,
    onNavigate,
}: {
    label: string;
    href: string;
    iconKey: NavigationIconKey;
    unread?: number;
    mobile?: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const Icon = iconMap[iconKey];
    const [count, setCount] = useState(unread);

    useEffect(() => {
        setCount(unread);
    }, [unread]);

    useEffect(() => {
        if (iconKey !== 'notifications') return;

        const onRead = (event: Event) => {
            const detail = (event as CustomEvent<{ updated?: number }>).detail;
            const updated =
                typeof detail?.updated === 'number' && Number.isFinite(detail.updated)
                    ? Math.max(0, Math.floor(detail.updated))
                    : 0;

            if (updated > 0) {
                setCount((current) => Math.max(0, current - updated));
            }
        };

        window.addEventListener('coco:notifications-read', onRead);
        return () => window.removeEventListener('coco:notifications-read', onRead);
    }, [iconKey]);

    const active =
        href === '/'
            ? pathname === '/'
            : pathname === href || pathname.startsWith(href + '/');

    return (
        <Link
            href={href}
            prefetch={iconKey === 'notifications' ? false : undefined}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            aria-label={count > 0 ? `${label}、未読${count}件` : label}
            title={!mobile ? label : undefined}
            className={
                'group relative flex h-12 w-full items-center rounded-full transition-colors ' +
                (active
                    ? 'bg-sky-50 text-sky-600'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950')
            }
        >
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <Icon
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0"
                    strokeWidth={active ? 2.2 : 1.9}
                />
                {iconKey === 'notifications' && count > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold badge-text-white"
                    >
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </span>

            <span
                className={
                    'truncate text-[15px] font-medium ' +
                    (mobile ? 'block' : 'hidden xl:block')
                }
            >
                {label}
            </span>

            {active && !mobile && (
                <span
                    aria-hidden="true"
                    className="absolute -left-3 h-6 w-1 rounded-r-full bg-sky-500"
                />
            )}
        </Link>
    );
}
