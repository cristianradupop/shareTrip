"use client";

import { LogOut, Menu, MessageCircle, PlusCircle, Settings, Briefcase, UserCircle, X } from "lucide-react";
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
  { href: "/organizer/messages", label: "Messages", icon: MessageCircle },
  { href: "/organizer/profile", label: "My Profile", icon: UserCircle },
  { href: "/organizer/settings", label: "Settings", icon: Settings },
];

function NavList({ onNavigate, pendingRequests = 0 }: { onNavigate?: () => void; pendingRequests?: number }) {
  const pathname = usePathname();
  const logout = useLogout();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      <Link
        href="/organizer"
        onClick={onNavigate}
        className={cn(
          "mb-4 flex items-center gap-2 rounded-full px-4 py-3 font-semibold transition-colors",
          pathname === "/organizer"
            ? "bg-primary text-primary-foreground"
            : "bg-white/8 text-sidebar-foreground hover:bg-white/12",
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
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <Icon className="size-5" /> {label}
            {href === "/organizer/trips" && pendingRequests > 0 && (
              <span
                aria-label={`${pendingRequests} pending requests`}
                className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
              >
                {pendingRequests}
              </span>
            )}
          </Link>
        );
      })}
      <button
        onClick={logout}
        className="mt-auto flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <LogOut className="size-5" /> Logout
      </button>
    </nav>
  );
}

export function OrganizerShell({
  user,
  pendingRequests = 0,
  children,
}: {
  user: { name: string; image?: string | null };
  pendingRequests?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[1920px] md:flex md:gap-4 md:p-4">
      {/* desktop sidebar */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col gap-8 rounded-[2rem] bg-sidebar p-5 text-sidebar-foreground md:flex">
        <Logo className="px-2 pt-1 [&_span_span]:text-primary" href="/" />
        <NavList pendingRequests={pendingRequests} />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 m-3 rounded-[1.5rem] bg-sidebar text-sidebar-foreground md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo href="/" />
          <Button variant="ghost" size="icon" aria-label="Menu" className="rounded-full hover:bg-white/10 hover:text-white" onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <div className="flex flex-col border-t border-sidebar-border p-4">
            <NavList onNavigate={() => setOpen(false)} pendingRequests={pendingRequests} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 md:rounded-[2rem] md:bg-card">
        <div className="flex items-center justify-end gap-3 px-5 pt-4 md:px-8 md:pt-6">
          <ThemeToggle className="rounded-full" />
          <UserAvatar name={user.name} image={user.image} className="size-9" />
        </div>
        <main className="px-4 pb-12 pt-2 md:px-8">{children}</main>
      </div>
    </div>
  );
}
