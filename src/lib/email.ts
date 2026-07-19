import 'server-only';

type EmailMessage = {
    to: string;
    subject: string;
    text: string;
};

function emailFrom() {
    return process.env.EMAIL_FROM ?? process.env.PASSWORD_RESET_FROM_EMAIL ?? null;
}

export function isEmailDeliveryConfigured() {
    return Boolean(process.env.RESEND_API_KEY && emailFrom());
}

export async function sendTransactionalEmail(message: EmailMessage) {
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
