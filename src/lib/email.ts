import 'server-only';
import { appendFile } from 'node:fs/promises';
import { resolveE2eEmailOutboxPath } from '@/lib/emailDeliveryMode';

type EmailMessage = {
    to: string;
    subject: string;
    text: string;
};

function emailFrom() {
    return process.env.EMAIL_FROM ?? process.env.PASSWORD_RESET_FROM_EMAIL ?? null;
}

function e2eOutboxPath() {
    return resolveE2eEmailOutboxPath(process.env);
}

export function isEmailDeliveryConfigured() {
    return Boolean(e2eOutboxPath() || (process.env.RESEND_API_KEY && emailFrom()));
}

const EMAIL_PROVIDER_TIMEOUT_MS = 10_000;

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
        redirect: 'error',
        signal: AbortSignal.timeout(EMAIL_PROVIDER_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(
            `Transactional email provider returned HTTP ${response.status}.`,
        );
    }
}
