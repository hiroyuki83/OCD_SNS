'use client';

import Link from 'next/link';
import { useState } from 'react';

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

    return (
        <Link
            href={href}
            className={className}
            onClick={() => {
                setCount(0);
                onNavigate?.();
            }}
        >
            <span className="relative">
                {icon}
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] badge-text-white flex items-center justify-center">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </span>
            <span className={labelClassName ?? 'text-xl font-normal'}>{label}</span>
        </Link>
    );
}

