'use server';

import { revalidatePath } from 'next/cache';
import { AccountStatus, ReportPriority, ReportStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';

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
  if (!value || value.length > 64) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function requireModerator() {
  return requireAnyRole([Role.ADMIN, Role.MODERATOR]);
}

function canReviewTarget(actorRole: Role, targetRole: Role) {
  return actorRole === Role.ADMIN || targetRole === Role.USER;
}

function canSanctionTarget(actorRole: Role, targetRole: Role) {
  return targetRole !== Role.ADMIN && canReviewTarget(actorRole, targetRole);
}

async function allowSensitiveModeration(actorId: string) {
  return rateLimit(`moderation-sensitive:${actorId}`, 30, 15 * 60 * 1000);
}

export async function updateReportRouting(reportId: string, formData: FormData) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await rateLimit(`moderation-routing:${actor.id}`, 120, 15 * 60 * 1000))) return;
  const priority = priorityFromFormData(formData);
  if (!priority) return;

  const assignedToId = optionalText(formData, 'assignedToId');
  if (assignedToId && assignedToId.length > 128) return;
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
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        role: { in: [Role.ADMIN, Role.MODERATOR] },
      },
      select: { id: true, role: true },
    });
    if (!assignee) return;
    if (report.targetUser.role !== Role.USER && assignee.role !== Role.ADMIN) return;
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
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (report.status !== ReportStatus.OPEN) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

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
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  const note = noteFromFormData(formData);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

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
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  const note = noteFromFormData(formData);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

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
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowSensitiveModeration(actor.id))) return;
  const note = noteFromFormData(formData) ?? '通報対応により非表示';
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      postId: true,
      targetUserId: true,
      status: true,
      reason: true,
      targetUser: { select: { role: true } },
      post: { select: { deletedAt: true } },
    },
  });
  if (!report?.postId || report.post?.deletedAt) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

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

export async function restorePost(postId: string, _targetUserId: string, formData: FormData) {
  postId = postId.trim();
  if (!postId || postId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowSensitiveModeration(actor.id))) return;
  const note = noteFromFormData(formData);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      deletedAt: true,
      authorId: true,
      author: { select: { role: true } },
    },
  });
  if (!post || post.deletedAt) return;
  if (!canReviewTarget(actor.role, post.author.role)) return;

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
        targetUserId: post.authorId,
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
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowSensitiveModeration(actor.id))) return;
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
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!Object.values(AccountStatus).includes(status)) return;
  if (status !== AccountStatus.ACTIVE && (!note || note.length < 5)) return;
  if (!canSanctionTarget(actor.role, report.targetUser.role)) return;

  let suspendedUntil: Date | null = null;
  let restrictionUntil: Date | null = null;
  let suspensionDurationDays: number | null = null;
  let permanentSuspension = false;

  if (status === AccountStatus.POST_RESTRICTED) {
    const durationRaw = optionalText(formData, 'durationHours');
    const durationHours = durationRaw ? Number(durationRaw) : NaN;
    if (![1, 24, 72].includes(durationHours)) return;
    restrictionUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  }

  if (status === AccountStatus.SUSPENDED) {
    const durationRaw = optionalText(formData, 'durationDays');

    if (durationRaw === 'permanent') {
      if (actor.role !== Role.ADMIN) return;
      permanentSuspension = true;
    } else {
      const durationDays = durationRaw ? Number(durationRaw) : NaN;
      if (![1, 7, 30].includes(durationDays)) return;
      suspensionDurationDays = durationDays;
      suspendedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: report.targetUserId },
      data: {
        status,
        suspendedUntil,
        restrictionUntil,
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
          restrictionUntil,
          suspensionDurationDays,
          permanentSuspension,
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


export async function warnReportedUser(reportId: string, formData: FormData) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowSensitiveModeration(actor.id))) return;
  const note = noteFromFormData(formData);
  if (!note) return;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canSanctionTarget(actor.role, report.targetUser.role)) return;

  await prisma.$transaction(async (tx) => {
    const warning = await tx.moderationWarning.create({
      data: {
        reason: note,
        targetUserId: report.targetUserId,
        actorUserId: actor.id,
        reportId: report.id,
      },
      select: { id: true },
    });

    await tx.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: `警告: ${note}`,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'USER_WARNING',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: {
          warningId: warning.id,
          reportId: report.id,
          reason: note,
        },
      },
    });
  });

  revalidatePath('/moderation');
  revalidatePath(`/admin/users/${report.targetUserId}`);
  revalidatePath('/admin/audit');
}
