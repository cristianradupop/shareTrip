import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/");

  return (
    <>
      <h1 className="mb-1 text-center text-2xl font-bold text-primary">Create an account</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">Join the community and start traveling together.</p>
      <SignUpForm />
    </>
  );
}
