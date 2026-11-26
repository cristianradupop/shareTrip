import Link from "next/link";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton, UserAvatar } from "@/components/user-menu";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin(); // non-admins never reach any page below this layout
  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-3 p-3 sm:space-y-4 sm:p-4">
      <header className="rounded-[2rem] bg-ink text-ink-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Logo className="[&_span_span]:text-primary" />
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="mr-2 text-ink-foreground/65 hover:text-ink-foreground">
              View site
            </Link>
            <ThemeToggle className="rounded-full hover:bg-white/10 hover:text-white" />
            <UserAvatar name={admin.name} image={admin.image} className="size-9" />
            <LogoutButton className="rounded-full hover:bg-white/10 hover:text-white" />
          </div>
        </div>
        <AdminTabs />
      </header>
      <main className="rounded-[2rem] bg-card px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
