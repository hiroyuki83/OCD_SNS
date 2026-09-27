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

        fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationIds, warningIds }),
            cache: 'no-store',
            keepalive: true,
        })
            .then(async (response) => {
                if (!response.ok) return;
                const payload = await response.json().catch(() => null);
                const updated =
                    typeof payload?.updated === 'number' && Number.isFinite(payload.updated)
                        ? Math.max(0, Math.floor(payload.updated))
                        : 0;
                if (updated > 0) {
                    window.dispatchEvent(
                        new CustomEvent('coco:notifications-read', {
                            detail: { updated },
                        }),
                    );
                }
            })
            .catch(() => {
                // The notification list itself is still usable if marking read fails.
            });

    }, [notificationIds, warningIds]);

    return null;
}
