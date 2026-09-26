'use server';

import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { generateStaffRecoveryCodes, hashRecoveryCode } from '@/lib/recoveryCodes';
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
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const uri = buildTotpUri({ secret, accountName: user.email });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        staffTotpSecretEncrypted: encrypted,
        staffTotpEnabledAt: null,
        staffTotpLastUsedStep: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'STAFF_TOTP_SETUP_STARTED',
        actorUserId: user.id,
        targetUserId: user.id,
        meta: {},
      },
    }),
  ]);

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
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。' };
  }

  const enabledAt = new Date();
  const recoveryCodes = generateStaffRecoveryCodes();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        staffTotpEnabledAt: enabledAt,
        staffTotpLastUsedStep: step,
      },
    });

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
        },
      },
    });
  });

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
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。次のコードを待ってください。' };
  }

  const recoveryCodes = generateStaffRecoveryCodes();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { staffTotpLastUsedStep: step },
    });

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
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const recoveryCodeValue = formData.get('recoveryCode');
  if (typeof recoveryCodeValue !== 'string' || !recoveryCodeValue.trim()) {
    return { message: 'リカバリーコードを入力してください。' };
  }

  const recovery = await prisma.staffRecoveryCode.findFirst({
    where: {
      userId: user.id,
      codeHash: hashRecoveryCode(recoveryCodeValue),
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

      await tx.user.update({
        where: { id: user.id },
        data: {
          staffTotpSecretEncrypted: encrypted,
          staffTotpEnabledAt: null,
          staffTotpLastUsedStep: null,
        },
      });

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
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof RecoveryCodeConsumedError) {
      return { message: 'このリカバリーコードは既に使用されています。' };
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
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  const code = normalizeCode(formData.get('code'));
  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code);
  if (step === null) return { message: '認証コードが正しくありません。' };
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) {
    return { message: 'この認証コードは既に使用されています。次のコードを待ってください。' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        staffTotpSecretEncrypted: null,
        staffTotpEnabledAt: null,
        staffTotpLastUsedStep: null,
      },
    }),
    prisma.staffRecoveryCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.auditLog.create({
      data: {
        action: 'STAFF_TOTP_DISABLED',
        actorUserId: user.id,
        targetUserId: user.id,
        meta: { recoveryCodesRevoked: true },
      },
    }),
  ]);

  revalidatePath('/settings');
  return { ok: true, message: '2段階認証を解除しました。' };
}
