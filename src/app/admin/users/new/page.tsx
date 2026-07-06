import Link from 'next/link';
import { Role } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import CreateUserForm from '../CreateUserForm';

export default async function AdminNewUserPage() {
  await requireRole(Role.ADMIN);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-900">
          ユーザー管理へ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">ユーザーを作成</h1>
        <p className="mt-1 text-sm text-zinc-500">
          管理者が初期パスワード付きでユーザーを作成し、必要な権限を付与できます。
        </p>
      </div>

      <CreateUserForm />
    </div>
  );
}
