import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { requireAnyRole } from "@/lib/rbac";

export default async function ModerationLayout({ children }: { children: ReactNode }) {
  await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  return children;
}
