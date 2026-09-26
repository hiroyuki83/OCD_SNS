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

async function allowModerationDecision(actorId: string) {
  return rateLimit(`moderation-decision:${actorId}`, 120, 15 * 60 * 1000);
}

class ModerationConflictError extends Error {}

export async function updateReportRouting(reportId: string, formData: FormData) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await rateLimit(`moderation-routing:${actor.id}`, 120, 15 * 60 * 1000))) return;
  const priority = priorityFromFormData(formData);
  if (!priority) return;

  const assignedToId = optionalText(formData, 'assignedToId');
  if (assignedToId && assignedToId.length > 128) return;
  const dueAtRaw = optionalText(formData, 'dueAt');
  const dueAt = optionalDate(formData, 'dueAt');
  if (dueAtRaw && !dueAt) return;
  const note = noteFromFormData(formData);

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetUserId: true,
      status: true,
      priority: true,
      assignedToId: true,
      dueAt: true,
      targetUser: { select: { role: true } },
    },
  });
  if (!report) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;

  const routingChanged =
    report.priority !== priority ||
    report.assignedToId !== assignedToId ||
    report.dueAt?.getTime() !== dueAt?.getTime();
  if (!routingChanged && !note) return;

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

  await prisma.$transaction(async (tx) => {
    const currentReport = await tx.report.findUnique({
      where: { id: report.id },
      select: {
        status: true,
        priority: true,
        assignedToId: true,
        dueAt: true,
        targetUser: { select: { role: true } },
      },
    });
    if (
      !currentReport ||
      (currentReport.status !== ReportStatus.OPEN &&
        currentReport.status !== ReportStatus.REVIEWING) ||
      !canReviewTarget(actor.role, currentReport.targetUser.role)
    ) {
      return;
    }

    if (assignedToId) {
      const currentAssignee = await tx.user.findFirst({
        where: {
          id: assignedToId,
          role: { in: [Role.ADMIN, Role.MODERATOR] },
        },
        select: { role: true },
      });
      if (!currentAssignee) return;
      if (
        currentReport.targetUser.role !== Role.USER &&
        currentAssignee.role !== Role.ADMIN
      ) {
        return;
      }
    }

    const updated = await tx.report.updateMany({
      where: {
        id: report.id,
        status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      },
      data: {
        priority,
        assignedToId,
        dueAt,
      },
    });
    if (updated.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'REPORT_ROUTING',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: {
          reportId: report.id,
          fromPriority: currentReport.priority,
          toPriority: priority,
          fromAssignedToId: currentReport.assignedToId,
          toAssignedToId: assignedToId,
          fromDueAt: currentReport.dueAt,
          toDueAt: dueAt,
          note,
        },
      },
    });
  });

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function markReportReviewing(reportId: string) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowModerationDecision(actor.id))) return;
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

  await prisma.$transaction(async (tx) => {
    const freshTarget = await tx.user.findUnique({
      where: { id: report.targetUserId },
      select: { role: true },
    });
    if (!freshTarget || !canReviewTarget(actor.role, freshTarget.role)) return;

    const claimed = await tx.report.updateMany({
      where: { id: report.id, status: ReportStatus.OPEN },
      data: {
        status: ReportStatus.REVIEWING,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'REPORT_REVIEWING',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, toStatus: ReportStatus.REVIEWING },
      },
    });
  });

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function rejectReport(reportId: string, formData: FormData) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowModerationDecision(actor.id))) return;
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

  await prisma.$transaction(async (tx) => {
    const freshTarget = await tx.user.findUnique({
      where: { id: report.targetUserId },
      select: { role: true },
    });
    if (!freshTarget || !canReviewTarget(actor.role, freshTarget.role)) return;

    const claimed = await tx.report.updateMany({
      where: {
        id: report.id,
        status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      },
      data: {
        status: ReportStatus.REJECTED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    });
    if (claimed.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'REPORT_REJECT',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, note },
      },
    });
  });

  revalidatePath('/moderation');
  revalidatePath('/admin/audit');
}

export async function resolveReport(reportId: string, formData: FormData) {
  reportId = reportId.trim();
  if (!reportId || reportId.length > 128) return;
  const actor = await requireModerator();
  if (!(await allowModerationDecision(actor.id))) return;
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

  await prisma.$transaction(async (tx) => {
    const freshTarget = await tx.user.findUnique({
      where: { id: report.targetUserId },
      select: { role: true },
    });
    if (!freshTarget || !canReviewTarget(actor.role, freshTarget.role)) return;

    const claimed = await tx.report.updateMany({
      where: {
        id: report.id,
        status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    });
    if (claimed.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'REPORT_RESOLVE',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: { reportId: report.id, fromStatus: report.status, note },
      },
    });
  });

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
      post: { select: { deletedAt: true, isHidden: true } },
    },
  });
  if (!report?.postId || !report.post || report.post.deletedAt || report.post.isHidden) return;
  if (report.status !== ReportStatus.OPEN && report.status !== ReportStatus.REVIEWING) return;
  if (!canReviewTarget(actor.role, report.targetUser.role)) return;
  const postId = report.postId;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.report.updateMany({
        where: {
          id: report.id,
          status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
        },
        data: {
          status: ReportStatus.RESOLVED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          resolutionNote: note,
        },
      });
      if (claimed.count !== 1) return;

      const hidden = await tx.post.updateMany({
        where: { id: postId, deletedAt: null, isHidden: false },
        data: {
          isHidden: true,
          hiddenAt: new Date(),
          hiddenReason: note,
          hiddenById: actor.id,
        },
      });
      if (hidden.count !== 1) throw new ModerationConflictError();

      await tx.auditLog.create({
        data: {
          action: 'POST_HIDE',
          actorUserId: actor.id,
          targetUserId: report.targetUserId,
          meta: { reportId: report.id, postId, reason: report.reason, note },
        },
      });
    });
  } catch (error) {
    if (error instanceof ModerationConflictError) return;
    throw error;
  }

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
      isHidden: true,
      authorId: true,
      author: { select: { role: true } },
    },
  });
  if (!post || post.deletedAt || !post.isHidden) return;
  if (!canReviewTarget(actor.role, post.author.role)) return;

  await prisma.$transaction(async (tx) => {
    const restored = await tx.post.updateMany({
      where: { id: postId, deletedAt: null, isHidden: true },
      data: {
        isHidden: false,
        hiddenAt: null,
        hiddenReason: null,
        hiddenById: null,
      },
    });
    if (restored.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'POST_RESTORE',
        actorUserId: actor.id,
        targetUserId: post.authorId,
        meta: { postId, note },
      },
    });
  });

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

  await prisma.$transaction(async (tx) => {
    const currentTarget = await tx.user.findUnique({
      where: { id: report.targetUserId },
      select: { status: true },
    });
    if (!currentTarget) return;

    const claimed = await tx.report.updateMany({
      where: {
        id: report.id,
        status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: note,
      },
    });
    if (claimed.count !== 1) return;

    await tx.user.update({
      where: { id: report.targetUserId },
      data: {
        status,
        suspendedUntil,
        restrictionUntil,
        restrictionReason: status === AccountStatus.ACTIVE ? null : note,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'USER_STATUS_CHANGE',
        actorUserId: actor.id,
        targetUserId: report.targetUserId,
        meta: {
          reportId: report.id,
          reason: report.reason,
          fromStatus: currentTarget.status,
          toStatus: status,
          suspendedUntil,
          restrictionUntil,
          suspensionDurationDays,
          permanentSuspension,
          note,
        },
      },
    });
  });

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
  if (!note || note.length < 5) return;

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
    const claimed = await tx.report.updateMany({
      where: {
        id: report.id,
        status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resolutionNote: `警告: ${note}`,
      },
    });
    if (claimed.count !== 1) return;

    const warning = await tx.moderationWarning.create({
      data: {
        reason: note,
        targetUserId: report.targetUserId,
        actorUserId: actor.id,
        reportId: report.id,
      },
      select: { id: true },
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
