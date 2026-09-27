export type EmailModeEnv = {
  [key: string]: string | undefined;
  VERCEL_ENV?: string;
  E2E_EMAIL_MODE?: string;
  E2E_EMAIL_OUTBOX_FILE?: string;
};

export function resolveE2eEmailOutboxPath(env: EmailModeEnv) {
  if (env.VERCEL_ENV === 'production') return null;
  if (env.E2E_EMAIL_MODE !== '1') return null;
  const path = env.E2E_EMAIL_OUTBOX_FILE?.trim();
  return path || null;
}
