import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-next";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // Already signed in (also right after the form signs in and refreshes): go where the visitor was heading.
  const session = await getSession();
  if (session) {
    const home = (session.user as { role?: string }).role === "admin" ? "/admin" : "/";
    redirect(safeNext(typeof next === "string" ? next : undefined) ?? home);
  }

  return (
    <>
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-muted-foreground">Log in to organize or join a trip.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
