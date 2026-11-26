"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { trackInteraction } from "@/lib/analytics";
import { safeNext } from "@/lib/safe-next";
import { loginSchema, type LoginInput } from "server-app/shared";

export function LoginForm({ next }: { next?: string }) {
  const target = safeNext(next);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit({ identifier, password }: LoginInput) {
    setError(null);
    const id = identifier.trim();
    const res = id.includes("@")
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password });

    if (res.error) {
      // Same message for "no such user" and "wrong password" on purpose.
      setError("Wrong username/email or password");
      return;
    }
    trackInteraction("login");
    const role = (res.data?.user as { role?: string } | undefined)?.role;
    // A full page load, not router.push + refresh: the refresh re-rendered /login, which (now signed in)
    // redirected elsewhere and won the race against the push, so "Organize a trip" landed on the home page.
    window.location.assign(target ?? (role === "admin" ? "/admin" : "/"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Username or email" htmlFor="identifier" error={errors.identifier?.message} invalid={Boolean(errors.identifier)}>
        <Input id="identifier" autoComplete="username" aria-invalid={Boolean(errors.identifier)} {...register("identifier")} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message} invalid={Boolean(errors.password)}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </FormField>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account yet?{" "}
        <Link href={target ? `/signup?next=${encodeURIComponent(target)}` : "/signup"} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
