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
    password: z.string().min(8, 'パスワードは8文字以上です。').max(128, 'パスワードは128文字以内です。'),
    confirmPassword: z.string(),
    role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: '確認用パスワードが一致しません。',
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
