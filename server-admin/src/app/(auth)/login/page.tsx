import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-muted-foreground">Log in to organize or join a trip.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
