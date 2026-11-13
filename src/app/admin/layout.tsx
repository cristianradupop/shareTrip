import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton, UserAvatar } from "@/components/user-menu";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin(); // non-admins never reach any page below this layout
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <Logo className="text-primary" />
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Admin</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="mr-2 text-muted-foreground hover:text-foreground">
              View site
            </Link>
            <ThemeToggle />
            <UserAvatar name={admin.name} image={admin.image} className="size-9" />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
