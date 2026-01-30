import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import UsersTable from "./UsersTable";

export default async function AdminUsersPage() {
  await requireRole(Role.ADMIN);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const viewUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">ユーザー管理</h1>
          <p className="text-sm text-zinc-500 mt-1">権限の変更は監査ログに記録されます。</p>
        </div>
      </div>
      <UsersTable users={viewUsers} />
    </div>
  );
}

