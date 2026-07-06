'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

function formText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function optionalUrl(formData: FormData) {
  const value = formData.get('href');
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function optionalDate(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateAnnouncementViews() {
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/announcements');
  revalidatePath('/admin/audit');
}

export async function createAnnouncement(formData: FormData) {
  const actor = await requireRole(Role.ADMIN);
  const title = formText(formData, 'title', 80);
  const body = formText(formData, 'body', 600);
  if (!title || !body) return;

  const startsAt = optionalDate(formData, 'startsAt');
  const endsAt = optionalDate(formData, 'endsAt');
  if (startsAt && endsAt && startsAt >= endsAt) return;

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      href: optionalUrl(formData),
      isActive: formData.get('isActive') === 'on',
      startsAt,
      endsAt,
      createdById: actor.id,
    },
    select: { id: true, isActive: true, startsAt: true, endsAt: true },
  });

  await prisma.auditLog.create({
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

  revalidateAnnouncementViews();
}

export async function setAnnouncementActive(announcementId: string, isActive: boolean) {
  const actor = await requireRole(Role.ADMIN);
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, isActive: true },
  });
  if (!announcement || announcement.isActive === isActive) return;

  await prisma.$transaction([
    prisma.announcement.update({
      where: { id: announcement.id },
      data: { isActive },
    }),
    prisma.auditLog.create({
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
    }),
  ]);

  revalidateAnnouncementViews();
}
