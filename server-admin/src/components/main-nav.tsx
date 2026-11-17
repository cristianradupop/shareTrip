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

/** Top bar of the public landing page (white text on the hero image). */
export async function MainNav() {
  const session = await getSession();
  const user = session?.user;

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Logo className="text-white" />

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className={`${buttonVariants({ variant: "secondary", size: "sm" })} hidden sm:inline-flex`}>
                  Admin
                </Link>
              )}
              <UserAvatar name={user.name} image={user.image} className="size-9" />
              <LogoutButton className="text-white hover:bg-white/15 hover:text-white" />
            </>
          ) : (
            <Link
              href="/login"
              className={`${buttonVariants({ size: "lg" })} rounded-full bg-white/90 px-5 text-slate-900 hover:bg-white`}
            >
              Login / Sign Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
