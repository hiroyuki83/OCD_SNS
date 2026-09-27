'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';
import { parseTokyoDateTimeLocal } from '@/lib/tokyoDateTime';

function formText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (!normalized || Array.from(normalized).length > maxLength) return null;
  return normalized;
}

function optionalUrl(formData: FormData) {
  const value = formData.get('href');
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    if (url.username || url.password) return null;
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function optionalDate(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.length > 64) return null;
  return parseTokyoDateTimeLocal(value);
}

function revalidateAnnouncementViews() {
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/announcements');
  revalidatePath('/admin/audit');
}

export async function createAnnouncement(formData: FormData) {
  const actor = await requireRole(Role.ADMIN);
  if (!(await rateLimit(`announcement-create:${actor.id}`, 30, 60 * 60 * 1000))) return;
  const title = formText(formData, 'title', 80);
  const body = formText(formData, 'body', 600);
  if (!title || !body) return;

  const rawHref = formData.get('href');
  const href = optionalUrl(formData);
  if (typeof rawHref === 'string' && rawHref.trim() && !href) return;

  const rawStartsAt = formData.get('startsAt');
  const rawEndsAt = formData.get('endsAt');
  const startsAt = optionalDate(formData, 'startsAt');
  const endsAt = optionalDate(formData, 'endsAt');
  if (typeof rawStartsAt === 'string' && rawStartsAt.trim() && !startsAt) return;
  if (typeof rawEndsAt === 'string' && rawEndsAt.trim() && !endsAt) return;
  if (startsAt && endsAt && startsAt >= endsAt) return;

  await prisma.$transaction(async (tx) => {
    const currentActor = await tx.user.findUnique({
      where: { id: actor.id },
      select: { role: true },
    });
    if (currentActor?.role !== Role.ADMIN) return;

    const announcement = await tx.announcement.create({
      data: {
        title,
        body,
        href,
        isActive: formData.get('isActive') === 'on',
        startsAt,
        endsAt,
        createdById: actor.id,
      },
      select: { id: true, isActive: true, startsAt: true, endsAt: true },
    });

    await tx.auditLog.create({
      data: {
        action: 'ANNOUNCEMENT_CREATE',
        actorUserId: actor.id,
        targetUserId: actor.id,
        meta: {
          announcementId: announcement.id,
          isActive: announcement.isActive,
          startsAt: announcement.startsAt,
          endsAt: announcement.endsAt,
        },
      },
    });
  });

  revalidateAnnouncementViews();
}

export async function setAnnouncementActive(announcementId: string, isActive: boolean) {
  const actor = await requireRole(Role.ADMIN);
  if (typeof isActive !== 'boolean') return;
  const normalizedId = announcementId.trim();
  if (!normalizedId || normalizedId.length > 128) return;
  if (!(await rateLimit(`announcement-status:${actor.id}`, 120, 60 * 60 * 1000))) return;
  const announcement = await prisma.announcement.findUnique({
    where: { id: normalizedId },
    select: { id: true, isActive: true },
  });
  if (!announcement || announcement.isActive === isActive) return;

  await prisma.$transaction(async (tx) => {
    const currentActor = await tx.user.findUnique({
      where: { id: actor.id },
      select: { role: true },
    });
    if (currentActor?.role !== Role.ADMIN) return;

    const changed = await tx.announcement.updateMany({
      where: {
        id: announcement.id,
        isActive: announcement.isActive,
      },
      data: { isActive },
    });
    if (changed.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'ANNOUNCEMENT_STATUS',
        actorUserId: actor.id,
        targetUserId: actor.id,
        meta: {
          announcementId: announcement.id,
          fromActive: announcement.isActive,
          toActive: isActive,
        },
      },
    });
  });

  revalidateAnnouncementViews();
}


export async function updateAnnouncement(
  announcementId: string,
  expectedUpdatedAtIso: string,
  formData: FormData,
) {
  const actor = await requireRole(Role.ADMIN);
  const normalizedId = announcementId.trim();
  if (!normalizedId || normalizedId.length > 128) return;
  if (!(await rateLimit(`announcement-update:${actor.id}`, 60, 60 * 60 * 1000))) return;

  const expectedUpdatedAt = new Date(expectedUpdatedAtIso);
  if (Number.isNaN(expectedUpdatedAt.getTime())) return;

  const title = formText(formData, 'title', 80);
  const body = formText(formData, 'body', 600);
  if (!title || !body) return;

  const rawHref = formData.get('href');
  const href = optionalUrl(formData);
  if (typeof rawHref === 'string' && rawHref.trim() && !href) return;

  const rawStartsAt = formData.get('startsAt');
  const rawEndsAt = formData.get('endsAt');
  const startsAt = optionalDate(formData, 'startsAt');
  const endsAt = optionalDate(formData, 'endsAt');
  if (typeof rawStartsAt === 'string' && rawStartsAt.trim() && !startsAt) return;
  if (typeof rawEndsAt === 'string' && rawEndsAt.trim() && !endsAt) return;
  if (startsAt && endsAt && startsAt >= endsAt) return;

  await prisma.$transaction(async (tx) => {
    const currentActor = await tx.user.findUnique({
      where: { id: actor.id },
      select: { role: true },
    });
    if (currentActor?.role !== Role.ADMIN) return;

    const current = await tx.announcement.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
        startsAt: true,
        endsAt: true,
        updatedAt: true,
      },
    });
    if (!current || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return;

    const changed = await tx.announcement.updateMany({
      where: {
        id: normalizedId,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        title,
        body,
        href,
        startsAt,
        endsAt,
      },
    });
    if (changed.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: 'ANNOUNCEMENT_UPDATE',
        actorUserId: actor.id,
        targetUserId: actor.id,
        meta: {
          announcementId: normalizedId,
          fromTitle: current.title,
          toTitle: title,
          hrefChanged: current.href !== href,
          startsAtChanged: current.startsAt?.getTime() !== startsAt?.getTime(),
          endsAtChanged: current.endsAt?.getTime() !== endsAt?.getTime(),
        },
      },
    });
  });

  revalidateAnnouncementViews();
}
