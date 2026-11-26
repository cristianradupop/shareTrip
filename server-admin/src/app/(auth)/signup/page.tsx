import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">Create an account</h1>
      <p className="mb-8 text-muted-foreground">Join the community and start traveling together.</p>
      <SignUpForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
