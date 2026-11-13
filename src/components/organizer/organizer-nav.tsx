"use client";

import { Compass, LogOut, Menu, MessageCircle, PlusCircle, Settings, Briefcase, UserCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserAvatar, useLogout } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const items = [
  { href: "/organizer/trips", label: "My Trips", icon: Briefcase },
  { href: "/organizer?new=1", label: "Create Trip", icon: PlusCircle },
  { href: "/feed", label: "Community feed", icon: Compass },
  { href: "/organizer/messages", label: "Messages", icon: MessageCircle },
  { href: "/organizer/profile", label: "My Profile", icon: UserCircle },
  { href: "/organizer/settings", label: "Settings", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const logout = useLogout();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      <Link
        href="/organizer"
        onClick={onNavigate}
        className={cn(
          "mb-3 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm",
          pathname === "/organizer" ? "ring-2 ring-primary/40" : "opacity-95 hover:opacity-100",
        )}
      >
        <Briefcase className="size-5" /> Organizer
      </Link>
      {items.map(({ href, label, icon: Icon }) => {
        const active = !href.includes("?") && pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-5" /> {label}
          </Link>
        );
      })}
      <button
        onClick={logout}
        className="mt-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-5" /> Logout
      </button>
    </nav>
  );
}

export function OrganizerShell({
  user,
  children,
}: {
  user: { name: string; image?: string | null };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30 md:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-card p-5 md:flex">
        <Logo className="text-primary" href="/" />
        <NavList />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 border-b bg-card md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="text-primary" href="/" />
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <div className="flex flex-col border-t p-4">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 px-5 pt-4 md:px-8">
          <ThemeToggle />
          <UserAvatar name={user.name} image={user.image} className="size-9" />
        </div>
        <main className="px-5 pb-12 pt-2 md:px-8">{children}</main>
      </div>
    </div>
  );
}
