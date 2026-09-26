# CoCo

CoCo is a Next.js and Prisma social application with moderation, audit logging, psychological self-checks, private-account follow approval, and account safety controls.

## Local development

Copy `.env.example` to your local environment file and configure at least the database and authentication secret.

```bash
npm ci
npx prisma generate
npm run dev
```

Open http://localhost:3000 in your browser.

## Verification

The integration CI runs the same core checks used before release:

```bash
npx prisma validate
npx prisma generate
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Use `npm ci` rather than `npm install` in verification and deployment environments so the committed lockfile is authoritative.

## Production deployment

Vercel uses `npm run vercel-build`.

Preview builds generate the Prisma client and build Next.js, but do not mutate the database. Production builds validate required security configuration and then run `prisma migrate deploy` before the application build.

Required production environment variables:

- `DATABASE_URL`: production PostgreSQL connection string with migration access.
- `AUTH_SECRET`: long random NextAuth/Auth.js secret.
- `STAFF_MFA_ENCRYPTION_KEY`: stable base64-encoded 32-byte key used to encrypt staff TOTP secrets.

Generate the MFA encryption key once and keep it stable:

```bash
openssl rand -base64 32
```

A production build intentionally fails if any required variable above is missing or if `STAFF_MFA_ENCRYPTION_KEY` is not a valid 32-byte base64 key.

Additional production configuration:

- `BLOB_READ_WRITE_TOKEN`: required for image uploads.
- `RESEND_API_KEY` and `EMAIL_FROM`: required for registration, verification, invitation, and password-reset email delivery. Registration is paused when email delivery is not configured.

Do not commit production secrets or copy production values into `.env.example`.

## Staff security

ADMIN and MODERATOR accounts use TOTP MFA for privileged access. Staff recovery codes are stored as hashes. Administrative role and account-status changes require ADMIN password reauthentication, and privileged actions are written to the audit log.

Before promoting the first operational staff accounts, confirm that `STAFF_MFA_ENCRYPTION_KEY` is configured in the production environment and that recovery codes can be stored safely by the operator.
