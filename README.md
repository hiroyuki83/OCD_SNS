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

Preview and Production builds generate the Prisma client and build Next.js. Production builds also validate required security configuration. **Vercel builds do not run database migrations.** Production schema changes are executed separately through the guarded release workflow after database identity, rollback, and migration checks pass.

Application runtime prefers pooled database URLs (`DATABASE_URL`, then `POSTGRES_PRISMA_URL`). `POSTGRES_URL_NON_POOLING` is reserved as a fallback for runtime and is preferred by Prisma migration tooling when a direct connection is available.

Required production environment variables:

- `DATABASE_URL`: production PostgreSQL runtime connection string. Use the pooled Neon endpoint for the application.
- `AUTH_SECRET`: long random Auth.js secret. Legacy `NEXTAUTH_SECRET` is also accepted, but `AUTH_SECRET` is preferred.
- `STAFF_MFA_ENCRYPTION_KEY`: stable base64-encoded 32-byte key used to encrypt staff TOTP secrets.

Generate the MFA encryption key once and keep it stable:

```bash
openssl rand -base64 32
```

A production build intentionally fails if any required variable above is missing or if `STAFF_MFA_ENCRYPTION_KEY` is not a valid 32-byte base64 key.

Additional production configuration:

- `POSTGRES_URL_NON_POOLING`: direct/unpooled PostgreSQL connection used by migration tooling when available.
- `POSTGRES_PRISMA_URL`: pooled PostgreSQL connection accepted as an application-runtime fallback.
- `BLOB_READ_WRITE_TOKEN`: required for image uploads.
- `RESEND_API_KEY` and `EMAIL_FROM`: required for registration, verification, invitation, and password-reset email delivery. Registration is paused when email delivery is not configured.

Do not commit production secrets or copy production values into `.env.example`.

## Staff security

ADMIN and MODERATOR accounts use TOTP MFA for privileged access. Staff recovery codes are stored as hashes. Administrative role and account-status changes require ADMIN password reauthentication, and privileged actions are written to the audit log.

Before promoting the first operational staff accounts, confirm that `STAFF_MFA_ENCRYPTION_KEY` is configured in the production environment and that recovery codes can be stored safely by the operator.

## Preview test users

The integration branch can seed test-only accounts into a dedicated Vercel Preview database. The seed refuses to run unless `VERCEL_ENV=preview`, `PREVIEW_SEED_USERS=1`, and `DATABASE_URL` exactly matches `PREVIEW_DATABASE_URL`.

Configure these variables only for the Vercel Preview environment:

- `DATABASE_URL`: dedicated Preview database URL
- `PREVIEW_DATABASE_URL`: the same dedicated Preview database URL
- `PREVIEW_SEED_USERS=1`
- `PREVIEW_TEST_PASSWORD`: one 10-128 character password shared by the test accounts

A Preview build then creates or refreshes these verified accounts:

- `coco.preview.public1@example.com` — public user
- `coco.preview.public2@example.com` — public user
- `coco.preview.private@example.com` — private user
- `coco.preview.moderator@example.com` — moderator
- `coco.preview.admin@example.com` — admin

Never point Preview at the production database when preview seeding is enabled.
