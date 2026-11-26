import { LogOut } from "lucide-react";
import Link from "next/link";
import { ArrowBadge } from "@/components/arrow-badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton, UserAvatar } from "@/components/user-menu";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#trips", label: "Trips" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

/** Top row of the landing hero: sits on the photo, white text, no box of its own. */
export async function MainNav() {
  const session = await getSession();
  const user = session?.user;

  return (
    <header className="relative z-20 px-5 pt-5 sm:px-8 sm:pt-7">
      <div className="flex items-center justify-between gap-4">
        <Logo className="text-white [&_span_span]:text-white" />

        <nav className="hidden items-center gap-1 rounded-full bg-white/10 p-1 text-sm font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-md md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-1.5 transition-colors hover:bg-white hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="rounded-full text-white hover:bg-white/15 hover:text-white" />
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  data-track="nav-admin"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-9 rounded-full bg-white/10 px-4 text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white hover:text-ink max-sm:hidden",
                  )}
                >
                  Admin
                </Link>
              )}
              <UserAvatar name={user.name} image={user.image} className="size-9 ring-2 ring-white/70" />
              <LogoutButton className="rounded-full text-white hover:bg-white/15 hover:text-white max-sm:px-2.5">
                <LogOut className="size-4" />
                <span className="max-sm:sr-only">Logout</span>
              </LogoutButton>
            </>
          ) : (
            <Link
              href="/login"
              data-track="nav-login"
              className="group inline-flex h-11 items-center gap-3 rounded-full bg-white py-1 pl-5 pr-1 text-sm font-semibold text-ink shadow-lg shadow-black/20 transition-colors hover:bg-white/90"
            >
              <span>
                Login<span className="max-sm:hidden"> / Sign up</span>
              </span>
              <ArrowBadge direction="right" className="size-9" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
