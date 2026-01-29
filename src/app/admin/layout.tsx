import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import AdminTabs from "@/app/admin/AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(Role.ADMIN);
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
