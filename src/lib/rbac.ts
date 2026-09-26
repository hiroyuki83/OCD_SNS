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
  staffTotpEnabledAt: Date | null;
  staffMfaVerified: boolean;
};

type StaffMfaOptions = {
  allowUnenrolledStaff?: boolean;
};

function isStaffRole(role: Role) {
  return role === Role.ADMIN || role === Role.MODERATOR;
}

function staffMfaIssue(user: CurrentUser) {
  if (!isStaffRole(user.role)) return null;
  if (!user.staffTotpEnabledAt) return "unenrolled" as const;
  if (!user.staffMfaVerified) return "unverified" as const;
  return null;
}

function enforceStaffMfaForPage(user: CurrentUser, options?: StaffMfaOptions) {
  const issue = staffMfaIssue(user);
  if (!issue) return;

  if (issue === "unenrolled" && options?.allowUnenrolledStaff) {
    return;
  }

  if (issue === "unenrolled") {
    redirect("/settings/security");
  }

  redirect("/login?mfa=required");
}

function staffMfaApiError(user: CurrentUser) {
  const issue = staffMfaIssue(user);
  if (!issue) return null;

  return {
    error:
      issue === "unenrolled"
        ? "スタッフ2要素認証の設定が必要です。"
        : "スタッフ2要素認証で再ログインしてください。",
    status: 403,
  } as const;
}

export async function getCurrentUserWithRole(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  if (!userId && !email) return null;

  const user = await prisma.user.findUnique({
    where: userId ? { id: userId } : { email: email ?? "" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffTotpEnabledAt: true,
    },
  });

  if (!user) return null;
  return {
    ...user,
    staffMfaVerified: session?.user?.staffMfaVerified === true,
  };
}

export async function requireRole(role: Role, options?: StaffMfaOptions) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/login");
  if (user.role !== role) notFound();
  enforceStaffMfaForPage(user, options);
  return user;
}

export async function requireAnyRole(roles: Role[], options?: StaffMfaOptions) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) notFound();
  enforceStaffMfaForPage(user, options);
  return user;
}

export async function checkRoleApi(role: Role) {
  const user = await getCurrentUserWithRole();
  if (!user) return { error: "ログインが必要です。", status: 401 } as const;
  if (user.role !== role) return { error: "権限がありません。", status: 403 } as const;

  const mfaError = staffMfaApiError(user);
  if (mfaError) return mfaError;

  return { user } as const;
}

export async function checkAnyRoleApi(roles: Role[]) {
  const user = await getCurrentUserWithRole();
  if (!user) return { error: "ログインが必要です。", status: 401 } as const;
  if (!roles.includes(user.role)) return { error: "権限がありません。", status: 403 } as const;

  const mfaError = staffMfaApiError(user);
  if (mfaError) return mfaError;

  return { user } as const;
}

export async function requireRoleApi(role: Role) {
  const user = await getCurrentUserWithRole();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (user.role !== role) throw new Response("Forbidden", { status: 403 });

  const mfaError = staffMfaApiError(user);
  if (mfaError) throw new Response(mfaError.error, { status: mfaError.status });

  return user;
}

export async function requireAnyRoleApi(roles: Role[]) {
  const user = await getCurrentUserWithRole();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (!roles.includes(user.role)) throw new Response("Forbidden", { status: 403 });

  const mfaError = staffMfaApiError(user);
  if (mfaError) throw new Response(mfaError.error, { status: mfaError.status });

  return user;
}
