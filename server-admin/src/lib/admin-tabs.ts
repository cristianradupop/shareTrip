export type AdminTab = { label: string; href: string };

export const ADMIN_TABS: AdminTab[] = [
  { label: "Statistics", href: "/admin/statistics" },
  { label: "Accounts", href: "/admin" },
  { label: "Trips", href: "/admin/trips" },
  { label: "Activity", href: "/admin/activity" },
  { label: "Account history", href: "/admin/account-history" },
  { label: "Audit log", href: "/admin/audit-log" },
];

/** The tab a path belongs to: /admin matches exactly, the others by path segment. Query and trailing slash are ignored. */
export function activeAdminTab(pathname: string): AdminTab | undefined {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "");
  return ADMIN_TABS.find((t) => (t.href === "/admin" ? path === t.href : path === t.href || path.startsWith(`${t.href}/`)));
}
