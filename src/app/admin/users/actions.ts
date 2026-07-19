'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const CreateUserSchema = z
  .object({
    name: z.string().trim().max(50, '名前は50文字以内です。').optional(),
    email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください。'),
    password: z.string().min(10, 'パスワードは10文字以上です。').max(128, 'パスワードは128文字以内です。'),
    confirmPassword: z.string(),
    role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: '確認用パスワードが一致しません。',
  });

const ResetPasswordSchema = z
  .object({
    userId: z.string().min(1),
    password: z.string().min(10, 'パスワードは10文字以上です。').max(128, 'パスワードは128文字以内です。'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: '確認用パスワードが一致しません。',
  });

const AdminNoteSchema = z.object({
  userId: z.string().min(1),
  body: z.string().trim().min(1, 'メモ本文を入力してください。').max(1000, 'メモは1000文字以内です。'),
});

export type CreateUserState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        confirmPassword?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;

export type ResetPasswordState =
  | {
      errors?: {
        password?: string[];
        confirmPassword?: string[];
      };
      message?: string;
      ok?: boolean;
    }
  | undefined;

export type AdminNoteState =
  | {
      errors?: {
        body?: string[];
      };
      message?: string;
      ok?: boolean;
    }
  | undefined;

export async function createAdminUser(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const actor = await requireRole(Role.ADMIN);
  const parsed = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const { email, password, role } = parsed.data;
  const name = parsed.data.name?.trim() || null;
  const hashedPassword = await bcrypt.hash(password, 10);

  let createdUserId: string;
  try {
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          emailVerifiedAt: new Date(),
          password: hashedPassword,
          role,
        },
        select: { id: true, email: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_CREATE',
          actorUserId: actor.id,
          targetUserId: user.id,
          meta: {
            email: user.email,
            role: user.role,
          },
        },
      });

      return user;
    });
    createdUserId = createdUser.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { message: 'このメールアドレスは既に使用されています。' };
    }

    console.error('Failed to create admin-managed user:', error);
    return { message: 'ユーザー作成に失敗しました。' };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  redirect(`/admin/users/${createdUserId}`);
}

export async function resetUserPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const actor = await requireRole(Role.ADMIN);
  const parsed = ResetPasswordSchema.safeParse({
    userId: formData.get('userId'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const { userId, password } = parsed.data;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return { message: 'ユーザーが見つかりません。' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { password: hashedPassword, emailVerifiedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: {
          email: target.email,
          role: target.role,
        },
      },
    }),
  ]);

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/audit');
  return { ok: true, message: 'パスワードを再設定しました。' };
}

export async function createAdminNote(
  _prevState: AdminNoteState,
  formData: FormData,
): Promise<AdminNoteState> {
  const actor = await requireRole(Role.ADMIN);
  const parsed = AdminNoteSchema.safeParse({
    userId: formData.get('userId'),
    body: formData.get('body'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) {
    return { message: 'ユーザーが見つかりません。' };
  }

  await prisma.$transaction(async (tx) => {
    const note = await tx.adminNote.create({
      data: {
        targetUserId: target.id,
        authorId: actor.id,
        body: parsed.data.body,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        action: 'ADMIN_NOTE_CREATE',
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: {
          noteId: note.id,
        },
      },
    });
  });

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/audit');
  return { ok: true, message: '管理者メモを追加しました。' };
}
