'use server';

import { revalidatePath } from 'next/cache';
import { AccountStatus, ReportPriority, ReportStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';

function noteFromFormData(formData: FormData) {
  const value = formData.get('note');
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
}

function priorityFromFormData(formData: FormData) {
  const value = formData.get('priority');
  if (value === ReportPriority.LOW) return ReportPriority.LOW;
  if (value === ReportPriority.NORMAL) return ReportPriority.NORMAL;
  if (value === ReportPriority.HIGH) return ReportPriority.HIGH;
  if (value === ReportPriority.URGENT) return ReportPriority.URGENT;
  return null;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function requireModerator() {
  return requireAnyRole([Role.ADMIN, Role.MODERATOR]);
}

export async function updateReportRouting(reportId: string, formData: FormData) {
  const actor = await requireModerator();
  const priority = priorityFromFormData(formData);
  if (!priority) return;

  const assignedToId = optionalText(formData, 'assignedToId');
  const dueAt = optionalDate(formData, 'dueAt');
  const note = noteFromFormData(formData);

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      priority: true,
      assignedToId: true,
      dueAt: true,
    },
  });
  if (!report) return;

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        role: { in: [Role.ADMIN, Role.MODERATOR] },
      },
      select: { id: true },
    });
    if (!assignee) return;
  }

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: {
        priority,
        assignedToId,
        dueAt,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'REPORT_ROUTING',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: {
          reportId: report.id,
          fromPriority: report.priority,
          toPriority: priority,
          fromAssignedToId: report.assignedToId,
          toAssignedToId: assignedToId,
          fromDueAt: report.dueAt,
          toDueAt: dueAt,
          note,
        },
      },
    }),
  ]);

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
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
      post: { select: { deletedAt: true } },
    },
  });
  if (!report?.postId || report.post?.deletedAt) return;

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
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { deletedAt: true },
  });
  if (!post || post.deletedAt) return;

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
