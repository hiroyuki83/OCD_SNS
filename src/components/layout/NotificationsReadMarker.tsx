'use client';

import { useEffect } from 'react';

export default function NotificationsReadMarker() {
    useEffect(() => {
        fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            cache: 'no-store',
            keepalive: true,
        }).catch(() => {
            // The notification list itself is still usable if marking read fails.
        });
    }, []);

    return null;
}
