import { LogOut } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton, UserAvatar } from "@/components/user-menu";
import { getSession } from "@/lib/session";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

/** Top bar of the public landing page: a dark glass pill over the illustrated hero, sunset/lagoon accents. */
export async function MainNav() {
  const session = await getSession();
  const user = session?.user;

  return (
    <header className="absolute inset-x-0 top-0 z-20 px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/45 py-2 pl-5 pr-2 shadow-lg shadow-black/25 backdrop-blur-md">
        <Logo className="text-white [&_svg]:text-orange-400" />

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-200 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gradient-to-r after:from-orange-400 after:to-teal-300 after:transition-transform hover:text-orange-200 hover:after:scale-x-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="text-slate-200 hover:bg-white/10 hover:text-orange-300" />
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={`${buttonVariants({ variant: "ghost", size: "sm" })} rounded-full border border-teal-300/40 bg-teal-400/10 px-4 text-teal-200 hover:bg-teal-400/20 hover:text-teal-100 max-sm:hidden`}
                >
                  Admin
                </Link>
              )}
              <UserAvatar name={user.name} image={user.image} className="size-9 ring-2 ring-orange-400/60" />
              <LogoutButton className="text-slate-200 hover:bg-white/10 hover:text-orange-300 max-sm:px-2.5">
                <LogOut className="size-4" />
                <span className="max-sm:sr-only">Logout</span>
              </LogoutButton>
            </>
          ) : (
            <Link
              href="/login"
              className={`${buttonVariants({ size: "lg" })} rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-pink-400 max-sm:px-4`}
            >
              Login<span className="max-sm:hidden"> / Sign Up</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
