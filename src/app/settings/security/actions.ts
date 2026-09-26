'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { requireAnyRole } from '@/lib/rbac';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from '@/lib/totp';

export async function beginStaffTotpEnrollment() {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  if (!(await rateLimit(`staff-totp-enroll:${actor.id}`, 5, 60 * 60 * 1000))) {
    return;
  }

  const current = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      staffTotpEnabledAt: true,
    },
  });
  if (!current || current.staffTotpEnabledAt) return;

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);

  await prisma.user.update({
    where: { id: actor.id },
    data: {
      staffTotpSecretEncrypted: encrypted,
      staffTotpEnabledAt: null,
      staffTotpLastUsedStep: null,
    },
  });

  revalidatePath('/settings');
  revalidatePath('/settings/security');
}

export async function confirmStaffTotpEnrollment(formData: FormData) {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  if (!(await rateLimit(`staff-totp-confirm:${actor.id}`, 10, 15 * 60 * 1000))) {
    return;
  }

  const rawCode = formData.get('code');
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!/^\d{6}$/.test(code)) return;

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      staffTotpSecretEncrypted: true,
      staffTotpEnabledAt: true,
      staffTotpLastUsedStep: true,
    },
  });
  if (!user?.staffTotpSecretEncrypted || user.staffTotpEnabledAt) return;

  const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
  const step = verifyTotpCode(secret, code, { window: 1 });
  if (step === null) return;
  if (user.staffTotpLastUsedStep !== null && step <= user.staffTotpLastUsedStep) return;

  const enabledAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: actor.id },
      data: {
        staffTotpEnabledAt: enabledAt,
        staffTotpLastUsedStep: step,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'STAFF_TOTP_ENABLED',
        actorUserId: actor.id,
        targetUserId: actor.id,
        meta: { enabledAt },
      },
    }),
  ]);

  revalidatePath('/settings');
  revalidatePath('/settings/security');
  revalidatePath('/admin/audit');
}
