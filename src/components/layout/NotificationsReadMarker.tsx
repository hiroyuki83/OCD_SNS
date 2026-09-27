'use client';

import { useEffect } from 'react';

export default function NotificationsReadMarker({
    notificationIds,
    warningIds,
}: {
    notificationIds: string[];
    warningIds: string[];
}) {
    useEffect(() => {
        if (notificationIds.length === 0 && warningIds.length === 0) return;

        const controller = new AbortController();
        fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationIds, warningIds }),
            cache: 'no-store',
            keepalive: true,
            signal: controller.signal,
        }).catch(() => {
            // The notification list itself is still usable if marking read fails.
        });

        return () => controller.abort();
    }, [notificationIds, warningIds]);

    return null;
}
