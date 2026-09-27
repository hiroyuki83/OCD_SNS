'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotificationsLink({
    href,
    className,
    label,
    unread,
    icon,
    labelClassName,
    onNavigate,
}: {
    href: string;
    className?: string;
    label: string;
    unread: number;
    icon: React.ReactNode;
    labelClassName?: string;
    onNavigate?: () => void;
}) {
    const [count, setCount] = useState(unread);

    useEffect(() => {
        setCount(unread);
    }, [unread]);

    useEffect(() => {
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
    }, []);

    return (
        <Link
            href={href}
            prefetch={false}
            className={className}
            onClick={() => {
                onNavigate?.();
            }}
            aria-label={count > 0 ? `${label}、未読${count}件` : label}
        >
            <span className="relative">
                {icon}
                {count > 0 && (
                    <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] badge-text-white flex items-center justify-center">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </span>
            <span className={labelClassName ?? 'text-xl font-normal'}>{label}</span>
        </Link>
    );
}

