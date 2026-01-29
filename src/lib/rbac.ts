import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
};

export async function getCurrentUserWithRole(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  if (!userId && !email) return null;

  const user = await prisma.user.findUnique({
    where: userId ? { id: userId } : { email: email ?? "" },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) return null;
  return user;
}

export async function requireRole(role: Role) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/login");
  if (user.role !== role) notFound();
  return user;
}

export async function requireAnyRole(roles: Role[]) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) notFound();
  return user;
}

export async function requireRoleApi(role: Role) {
  const user = await getCurrentUserWithRole();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (user.role !== role) throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function requireAnyRoleApi(roles: Role[]) {
  const user = await getCurrentUserWithRole();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (!roles.includes(user.role)) throw new Response("Forbidden", { status: 403 });
  return user;
}
