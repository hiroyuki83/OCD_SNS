'use server';

import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { generateStaffRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from '@/lib/recoveryCodes';
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from '@/lib/totp';

export type TotpSetupState =
  | {
      ok?: boolean;
      message?: string;
      secret?: string;
      uri?: string;
      recoveryCodes?: string[];
    }
  | undefined;

function normalizeCode(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : '';
}

function isValidCurrentPassword(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128;
}

function isValidTotpCode(code: string) {
  return /^\d{6}$/.test(code);
}

async function currentStaff() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      staffTotpSecretEncrypted: true,
      staffTotpEnabledAt: true,
      staffTotpLastUsedStep: true,
    },
  });
}

function isStaff(role: Role) {
  return role === Role.ADMIN || role === Role.MODERATOR;
}

class TotpStateChangedError extends Error {}

export async function startStaffTotpSetup(
  _prevState: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const user = await currentStaff();
  if (!user || !isStaff(user.role)) return { message: 'この設定はスタッフ専用です。' };
  if (user.staffTotpEnabledAt) {
    return { message: '2段階認証は既に有効です。再登録する場合は復旧手続きを使用してください。' };
  }

  if (!(await rateLimit(`staff-totp-setup:${user.id}`, 5, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password) || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const uri = buildTotpUri({ secret, accountName: user.email });

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
          staffTotpEnabledAt: null,
          staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
        },
        data: {
          staffTotpSecretEncrypted: encrypted,
          staffTotpEnabledAt: null,
          staffTotpLastUsedStep: null,
        },
      });
      if (changed.count !== 1) throw new TotpStateChangedError();

      await tx.auditLog.create({
        data: {
          action: 'STAFF_TOTP_SETUP_STARTED',
          actorUserId: user.id,
          targetUserId: user.id,
          meta: {},
        },
      });
    });
  } catch (error) {
    if (error instanceof TotpStateChangedError) {
      return { message: '2段階認証の状態が変更されました。画面を更新して再度お試しください。' };
    }
    throw error;
  }

  revalidatePath('/settings');
  return {
    ok: true,
    message: '認証アプリに登録し、表示された6桁コードで有効化してください。',
    secret,
    uri,
  };
}

export async function enableStaffTotp(
  _prevState: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const user = await currentStaff();
  if (!user || !isStaff(user.role)) return { message: 'この設定はスタッフ専用です。' };
  if (!user.staffTotpSecretEncrypted) return { message: '先に2段階認証の登録を開始してください。' };

  if (!(await rateLimit(`staff-totp-enable:${user.id}`, 10, 15 * 60 * 1000))) {
    return { message: '確認回数が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password) || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  if (!isValidTotpCode(code)) return { message: '認証コードが正しくありません。' };
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。' };
  }

  const enabledAt = new Date();
  const recoveryCodes = generateStaffRecoveryCodes();

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
          staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
          staffTotpEnabledAt: null,
          OR: [
            { staffTotpLastUsedStep: null },
            { staffTotpLastUsedStep: { lt: step } },
          ],
        },
        data: {
          staffTotpEnabledAt: enabledAt,
          staffTotpLastUsedStep: step,
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new TotpStateChangedError();

      await tx.staffRecoveryCode.deleteMany({
        where: { userId: user.id },
      });

      await tx.staffRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          userId: user.id,
          codeHash: hashRecoveryCode(recoveryCode),
        })),
      });

      await tx.auditLog.create({
        data: {
          action: 'STAFF_TOTP_ENABLED',
          actorUserId: user.id,
          targetUserId: user.id,
          meta: {
            enabledAt,
            recoveryCodeCount: recoveryCodes.length,
            sessionsRevoked: true,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof TotpStateChangedError) {
      return { message: '認証コードが既に使用されたか、2段階認証の状態が変更されました。' };
    }
    throw error;
  }

  revalidatePath('/settings');
  return {
    ok: true,
    message: '2段階認証を有効にしました。リカバリーコードを安全な場所に保存してください。',
    recoveryCodes,
  };
}

export async function regenerateStaffRecoveryCodes(
  _prevState: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const user = await currentStaff();
  if (!user || !isStaff(user.role)) return { message: 'この設定はスタッフ専用です。' };
  if (!user.staffTotpSecretEncrypted || !user.staffTotpEnabledAt) {
    return { message: '2段階認証が有効になっていません。' };
  }

  if (!(await rateLimit(`staff-recovery-regenerate:${user.id}`, 5, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password) || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  if (!isValidTotpCode(code)) return { message: '認証コードが正しくありません。' };
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。次のコードを待ってください。' };
  }

  const recoveryCodes = generateStaffRecoveryCodes();

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
          staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
          staffTotpEnabledAt: user.staffTotpEnabledAt,
          OR: [
            { staffTotpLastUsedStep: null },
            { staffTotpLastUsedStep: { lt: step } },
          ],
        },
        data: { staffTotpLastUsedStep: step },
      });
      if (changed.count !== 1) throw new TotpStateChangedError();

      await tx.staffRecoveryCode.deleteMany({
        where: { userId: user.id },
      });

      await tx.staffRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          userId: user.id,
          codeHash: hashRecoveryCode(recoveryCode),
        })),
      });

      await tx.auditLog.create({
        data: {
          action: 'STAFF_RECOVERY_CODES_REGENERATED',
          actorUserId: user.id,
          targetUserId: user.id,
          meta: { recoveryCodeCount: recoveryCodes.length },
        },
      });
    });
  } catch (error) {
    if (error instanceof TotpStateChangedError) {
      return { message: 'この認証コードは既に使用されたか、2段階認証の状態が変更されました。' };
    }
    throw error;
  }

  revalidatePath('/settings');
  return {
    ok: true,
    message: 'リカバリーコードを再発行しました。古いコードはすべて無効です。',
    recoveryCodes,
  };
}

class RecoveryCodeConsumedError extends Error {}

export async function recoverStaffTotpWithRecoveryCode(
  _prevState: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const user = await currentStaff();
  if (!user || !isStaff(user.role)) return { message: 'この設定はスタッフ専用です。' };
  if (!user.staffTotpEnabledAt) {
    return { message: '2段階認証は有効になっていません。' };
  }

  if (!(await rateLimit(`staff-totp-recovery:${user.id}`, 3, 60 * 60 * 1000))) {
    return { message: '復旧試行が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password) || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const recoveryCodeValue = formData.get('recoveryCode');
  if (typeof recoveryCodeValue !== 'string' || recoveryCodeValue.length > 64) {
    return { message: 'リカバリーコードを入力してください。' };
  }
  const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCodeValue);
  if (normalizedRecoveryCode.length !== 16) {
    return { message: 'リカバリーコードを確認できませんでした。' };
  }

  const recovery = await prisma.staffRecoveryCode.findFirst({
    where: {
      userId: user.id,
      codeHash: hashRecoveryCode(normalizedRecoveryCode),
      usedAt: null,
    },
    select: { id: true },
  });
  if (!recovery) {
    return { message: 'リカバリーコードを確認できませんでした。' };
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const uri = buildTotpUri({ secret, accountName: user.email });
  const resetAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.staffRecoveryCode.updateMany({
        where: {
          id: recovery.id,
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: resetAt },
      });
      if (consumed.count !== 1) {
        throw new RecoveryCodeConsumedError();
      }

      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
          staffTotpEnabledAt: user.staffTotpEnabledAt,
          staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
        },
        data: {
          staffTotpSecretEncrypted: encrypted,
          staffTotpEnabledAt: null,
          staffTotpLastUsedStep: null,
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new TotpStateChangedError();

      await tx.staffRecoveryCode.deleteMany({
        where: { userId: user.id },
      });

      await tx.auditLog.create({
        data: {
          action: 'STAFF_TOTP_RECOVERY_STARTED',
          actorUserId: user.id,
          targetUserId: user.id,
          meta: {
            recoveryCodeId: recovery.id,
            resetAt,
            previousRecoveryCodesRevoked: true,
            sessionsRevoked: true,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof RecoveryCodeConsumedError) {
      return { message: 'このリカバリーコードは既に使用されています。' };
    }
    if (error instanceof TotpStateChangedError) {
      return { message: '2段階認証の状態が変更されました。画面を更新して再度お試しください。' };
    }
    throw error;
  }

  revalidatePath('/settings');
  return {
    ok: true,
    message: '新しい認証アプリを登録し、6桁コードで再有効化してください。',
    secret,
    uri,
  };
}

export async function disableStaffTotp(
  _prevState: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const user = await currentStaff();
  if (!user || !isStaff(user.role)) return { message: 'この設定はスタッフ専用です。' };
  if (!user.staffTotpSecretEncrypted || !user.staffTotpEnabledAt) {
    return { message: '2段階認証は有効になっていません。' };
  }

  if (!(await rateLimit(`staff-totp-disable:${user.id}`, 5, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password) || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  if (!isValidTotpCode(code)) return { message: '認証コードが正しくありません。' };
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。次のコードを待ってください。' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
          staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
          staffTotpEnabledAt: user.staffTotpEnabledAt,
          OR: [
            { staffTotpLastUsedStep: null },
            { staffTotpLastUsedStep: { lt: step } },
          ],
        },
        data: {
          staffTotpSecretEncrypted: null,
          staffTotpEnabledAt: null,
          staffTotpLastUsedStep: null,
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new TotpStateChangedError();

      await tx.staffRecoveryCode.deleteMany({
        where: { userId: user.id },
      });

      await tx.auditLog.create({
        data: {
          action: 'STAFF_TOTP_DISABLED',
          actorUserId: user.id,
          targetUserId: user.id,
          meta: {
            recoveryCodesRevoked: true,
            sessionsRevoked: true,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof TotpStateChangedError) {
      return { message: 'この認証コードは既に使用されたか、2段階認証の状態が変更されました。' };
    }
    throw error;
  }

  revalidatePath('/settings');
  return { ok: true, message: '2段階認証を解除しました。' };
}


export type SessionSecurityState =
  | {
      ok?: boolean;
      message?: string;
    }
  | undefined;

export async function revokeAllSessions(
  _prevState: SessionSecurityState,
  formData: FormData,
): Promise<SessionSecurityState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { message: 'ログインしてください。' };

  if (!(await rateLimit(`session-revoke-all:${userId}`, 5, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const password = formData.get('currentPassword');
  if (!isValidCurrentPassword(password)) {
    return { message: '現在のパスワードを入力してください。' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      sessionVersion: true,
    },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const revokedAt = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        sessionVersion: user.sessionVersion,
      },
      data: {
        sessionVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        action: 'USER_SESSIONS_REVOKED',
        actorUserId: userId,
        targetUserId: userId,
        meta: {
          revokedAt,
          previousSessionVersion: user.sessionVersion,
          sessionsRevoked: true,
        },
      },
    });
    return true;
  });

  if (!changed) {
    return { message: 'セッション状態が変更されました。画面を更新して再度お試しください。' };
  }

  await signOut({ redirectTo: '/login' });
  return { ok: true, message: 'すべての端末からログアウトしました。' };
}
