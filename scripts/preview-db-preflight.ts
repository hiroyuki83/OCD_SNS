import { Client } from 'pg';
import {
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

const safety = validatePreviewMigrationSafety({
  vercelEnv: process.env.VERCEL_ENV,
  gitRef: process.env.VERCEL_GIT_COMMIT_REF,
  databaseUrl: process.env.DATABASE_URL,
  previewDatabaseUrl: process.env.PREVIEW_DATABASE_URL,
  confirmation: process.env.PREVIEW_MIGRATION_CONFIRM,
});

if (!safety.ok) {
  console.error(safety.error);
  process.exit(1);
}

const client = new Client({ connectionString: safety.previewDatabaseUrl });

const columnExists = async (table: string, column: string) => {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS present`,
    [table, column],
  );
  return Boolean(result.rows[0]?.present);
};

const tableExists = async (table: string) => {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS present`,
    [table],
  );
  return Boolean(result.rows[0]?.present);
};

try {
  await client.connect();

  const database = await client.query('SELECT current_database() AS name');
  if (database.rows[0]?.name !== safety.databaseName) {
    throw new Error('Connected database name does not match the approved Preview database.');
  }

  const signatures = {
    user: await tableExists('User'),
    post: await tableExists('Post'),
    warningAppeal: await tableExists('WarningAppeal'),
    staffRecoveryCode: await tableExists('StaffRecoveryCode'),
    reply: await tableExists('Reply'),
    handle: await columnExists('User', 'handle'),
    sessionVersion: await columnExists('User', 'sessionVersion'),
    quotePostId: await columnExists('Post', 'quotePostId'),
    imageAlt: await columnExists('Post', 'imageAlt'),
    notifyLikes: await columnExists('User', 'notifyLikes'),
    notifyReactions: await columnExists('User', 'notifyReactions'),
    notifyFollows: await columnExists('User', 'notifyFollows'),
    pendingEmail: await columnExists('EmailVerificationToken', 'pendingEmail'),
  };

  const requiredExisting = [
    ['User table', signatures.user],
    ['Post table', signatures.post],
    ['WarningAppeal table', signatures.warningAppeal],
    ['StaffRecoveryCode table', signatures.staffRecoveryCode],
    ['User.handle', signatures.handle],
    ['User.sessionVersion', signatures.sessionVersion],
  ] as const;

  const missing = requiredExisting.filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Preview DB is missing expected pre-baseline schema: ${missing.join(', ')}`);
  }

  const expectedPendingState = [
    ['Reply table still present', signatures.reply],
    ['Post.quotePostId still present', signatures.quotePostId],
    ['Post.imageAlt not yet present', !signatures.imageAlt],
    ['User.notifyLikes not yet present', !signatures.notifyLikes],
    ['User.notifyReactions not yet present', !signatures.notifyReactions],
    ['User.notifyFollows not yet present', !signatures.notifyFollows],
    ['EmailVerificationToken.pendingEmail not yet present', !signatures.pendingEmail],
  ] as const;

  const drift = expectedPendingState.filter(([, ok]) => !ok).map(([name]) => name);
  if (drift.length) {
    throw new Error(
      `Preview DB is not in the expected pre-migration state; manual reconciliation required: ${drift.join(', ')}`,
    );
  }

  console.log('Preview DB connection safety check passed.');
  console.log({
    database: safety.databaseName,
    hostname: safety.hostname,
    migrationState: {
      replyTablePresent: signatures.reply,
      quotePostIdPresent: signatures.quotePostId,
      imageAltPresent: signatures.imageAlt,
      notifyLikesPresent: signatures.notifyLikes,
      notifyReactionsPresent: signatures.notifyReactions,
      notifyFollowsPresent: signatures.notifyFollows,
      pendingEmailPresent: signatures.pendingEmail,
    },
  });
} finally {
  await client.end().catch(() => undefined);
}
