"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_TABS, activeAdminTab } from "@/lib/admin-tabs";
import { cn } from "@/lib/utils";

export function AdminTabs() {
  const active = activeAdminTab(usePathname());
  return (
    <nav aria-label="Admin sections" className="mx-auto max-w-6xl overflow-x-auto px-5">
      <ul className="flex min-w-max gap-1">
        {ADMIN_TABS.map((t) => {
          const isActive = t.href === active?.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
