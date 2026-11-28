"use client";

import { ArrowUpRight, Compass, LayoutDashboard, LogOut, Menu, Plane, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowBadge } from "@/components/arrow-badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogoutButton, UserAvatar, useLogout } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const items = [
  { href: "/joiner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/joiner/trips", label: "My Trips", icon: Plane },
  { href: "/joiner/requests", label: "My Requests", icon: Compass },
  { href: "/joiner/profile", label: "My Profile", icon: UserRound },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <nav aria-label="Joiner navigation" className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/joiner" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
            )}
          >
            <Icon className="size-5" /> {label}
          </Link>
        );
      })}
      <div aria-hidden className="mx-4 my-2 h-px bg-border" />
      <Link
        href="/#trips"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
      >
        <ArrowUpRight className="size-5" /> Discover trips
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
      >
        <LogOut className="size-5" /> Logout
      </button>
    </nav>
  );
}

export function JoinerShell({
  user,
  children,
}: {
  user: { name: string; firstName: string; username: string | null; image: string | null };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1920px] md:flex md:gap-4 md:p-4">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col gap-7 rounded-[2rem] bg-white ring-1 ring-border p-5 text-foreground md:flex">
        <Logo className="px-2 pt-1 [&_span_span]:text-primary" href="/" />
        <div className="flex items-center gap-3 rounded-[1.25rem] bg-primary/8 p-3">
          <UserAvatar name={user.name} image={user.image} className="size-11 ring-2 ring-white/10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/55">{user.username ? `@${user.username}` : "Traveler account"}</p>
          </div>
        </div>
        <NavItems />
        <div className="rounded-[1.5rem] bg-primary p-4 text-primary-foreground">
          <Compass className="mb-3 size-6" />
          <p className="font-semibold">Your next adventure starts here.</p>
          <p className="mt-1 text-xs text-primary-foreground/75">Explore trips and find people to travel with.</p>
          <Link href="/#trips" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline">
            Browse trips <ArrowBadge direction="right" tone="light" className="size-8" />
          </Link>
        </div>
      </aside>

      <div className="sticky top-0 z-30 m-3 rounded-[1.5rem] bg-white ring-1 ring-border text-foreground md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <Link href="/joiner/profile" aria-label="My Profile">
              <UserAvatar name={user.name} image={user.image} className="size-9 ring-2 ring-white/15" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="joiner-mobile-navigation"
              className="rounded-full hover:bg-white/10 hover:text-white"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <div id="joiner-mobile-navigation" className="flex flex-col border-t border-sidebar-border p-4">
            <NavItems onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 md:rounded-[2rem] md:bg-card md:ring-1 md:ring-border">
        <header className="flex items-center justify-between gap-3 px-5 pt-4 md:px-8 md:pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Traveler workspace</p>
            <p className="mt-1 font-medium">Welcome back, {user.firstName}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="rounded-full" />
            <Link href="/joiner/profile" aria-label="Open My Profile" className="hidden items-center gap-2 rounded-full p-1 pr-3 hover:bg-muted sm:flex">
              <UserAvatar name={user.name} image={user.image} className="size-9" />
              <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
            </Link>
            <LogoutButton className="h-9 rounded-full px-4 max-sm:hidden" />
          </div>
        </header>
        <main className="px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
