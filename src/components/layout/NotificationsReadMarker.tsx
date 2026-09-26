'use client';

import { useEffect } from 'react';

export default function NotificationsReadMarker() {
    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            cache: 'no-store',
            signal: controller.signal,
        }).catch(() => {
            // The notification list itself is still usable if marking read fails.
        });

        return () => controller.abort();
    }, []);

    return null;
}
