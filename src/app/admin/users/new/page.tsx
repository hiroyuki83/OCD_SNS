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
          名前・メールアドレス・権限を指定して招待します。本人が招待リンクから自分でパスワードを設定します。
        </p>
      </div>

      <CreateUserForm />
    </div>
  );
}
