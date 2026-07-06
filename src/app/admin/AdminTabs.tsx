"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/moderation", label: "Moderation" },
] as const;

export default function AdminTabs() {
  const pathname = usePathname();

  if (!pathname || pathname === "/admin") return null;

  return (
    <div className="border-b border-border px-6 pt-6">
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "px-4 py-2 rounded-t-md text-sm font-semibold transition-colors " +
                (isActive
                  ? "bg-white border border-border border-b-white text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
