"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_TABS, activeAdminTab } from "@/lib/admin-tabs";
import { cn } from "@/lib/utils";

export function AdminTabs() {
  const active = activeAdminTab(usePathname());
  return (
    <nav aria-label="Admin sections" className="overflow-x-auto px-3 pb-3 pt-4 sm:px-5">
      <ul className="flex min-w-max gap-1">
        {ADMIN_TABS.map((t) => {
          const isActive = t.href === active?.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-ink-foreground/65 hover:bg-white/10 hover:text-ink-foreground",
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
