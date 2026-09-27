import 'server-only';
import { appendFile } from 'node:fs/promises';

type EmailMessage = {
    to: string;
    subject: string;
    text: string;
};

function emailFrom() {
    return process.env.EMAIL_FROM ?? process.env.PASSWORD_RESET_FROM_EMAIL ?? null;
}

function e2eOutboxPath() {
    if (process.env.VERCEL_ENV === 'production') return null;
    if (process.env.E2E_EMAIL_MODE !== '1') return null;
    const path = process.env.E2E_EMAIL_OUTBOX_FILE?.trim();
    return path || null;
}

export function isEmailDeliveryConfigured() {
    return Boolean(e2eOutboxPath() || (process.env.RESEND_API_KEY && emailFrom()));
}

export async function sendTransactionalEmail(message: EmailMessage) {
    const outboxPath = e2eOutboxPath();
    if (outboxPath) {
        await appendFile(
            outboxPath,
            `${JSON.stringify({
                ...message,
                capturedAt: new Date().toISOString(),
            })}\n`,
            'utf8',
        );
        return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = emailFrom();
    if (!apiKey || !from) {
        throw new Error('Transactional email is not configured.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, ...message }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to send transactional email: ${response.status} ${body}`);
    }
}
