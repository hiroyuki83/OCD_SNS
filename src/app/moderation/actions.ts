'use server';

import { revalidatePath } from 'next/cache';
import { AccountStatus, ReportStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';

function noteFromFormData(formData: FormData) {
  const value = formData.get('note');
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
}

async function requireModerator() {
  return requireAnyRole([Role.ADMIN, Role.MODERATOR]);
}

export async function markReportReviewing(reportId: string) {
  const actor = await requireModerator();
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetUserId: true, status: true },
  });
  if (!report) return;

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.REVIEWING,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'REPORT_REVIEWING',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, toStatus: ReportStatus.REVIEWING },
      },
    }),
  ]);

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function rejectReport(reportId: string, formData: FormData) {
  const actor = await requireModerator();
  const note = noteFromFormData(formData);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetUserId: true, status: true },
  });
  if (!report) return;

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.REJECTED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'REPORT_REJECT',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, note },
      },
    }),
  ]);

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function resolveReport(reportId: string, formData: FormData) {
  const actor = await requireModerator();
  const note = noteFromFormData(formData);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetUserId: true, status: true },
  });
  if (!report) return;

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'REPORT_RESOLVE',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, note },
      },
    }),
  ]);

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function hideReportedPost(reportId: string, formData: FormData) {
  const actor = await requireModerator();
  const note = noteFromFormData(formData) ?? '通報対応により非表示';
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      postId: true,
      targetUserId: true,
      status: true,
      reason: true,
    },
  });
  if (!report?.postId) return;

  await prisma.$transaction([
    prisma.post.update({
      where: { id: report.postId },
      data: {
        isHidden: true,
        hiddenAt: new Date(),
        hiddenReason: note,
        hiddenById: actor.id,
      },
    }),
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'POST_HIDE',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, postId: report.postId, reason: report.reason, note },
      },
    }),
  ]);

  revalidatePath('/');
  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function restorePost(postId: string, targetUserId: string, formData: FormData) {
  const actor = await requireModerator();
  const note = noteFromFormData(formData);

  await prisma.$transaction([
    prisma.post.update({
      where: { id: postId },
      data: {
        isHidden: false,
        hiddenAt: null,
        hiddenReason: null,
        hiddenById: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'POST_RESTORE',
        actorUserId: actor.id,
        targetUserId,
        meta: { postId, note },
      },
    }),
  ]);

  revalidatePath('/');
  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function setReportedUserStatus(
  reportId: string,
  status: AccountStatus,
  formData: FormData,
) {
  const actor = await requireModerator();
  const note = noteFromFormData(formData);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      reason: true,
      targetUser: { select: { role: true, status: true } },
    },
  });
  if (!report) return;
  if (report.targetUser.role === Role.ADMIN && actor.role !== Role.ADMIN) return;

  const suspendedUntil =
    status === AccountStatus.SUSPENDED
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: report.targetUserId },
      data: {
        status,
        suspendedUntil,
        restrictionReason: status === AccountStatus.ACTIVE ? null : note,
      },
    }),
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'USER_STATUS_CHANGE',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: {
          reportId: report.id,
          reason: report.reason,
          fromStatus: report.targetUser.status,
          toStatus: status,
          suspendedUntil,
          note,
        },
      },
    }),
  ]);

  revalidatePath('/');
  revalidatePath('/moderation');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
}
