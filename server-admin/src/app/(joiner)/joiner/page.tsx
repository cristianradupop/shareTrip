import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Joiner" };

// Placeholder: the Joiner area (browse trips, bookings, join, group chat) is built by another developer.
export default async function JoinerPage() {
  await requireUser();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
      <Logo className="text-joiner" />
      <h1 className="text-3xl font-bold">Joiner area — coming soon</h1>
      <p className="max-w-md text-muted-foreground">
        Browsing and joining trips will be available here. In the meantime you can look at the community feed.
      </p>
      <div className="flex gap-3">
        <Link href="/feed" className={buttonVariants({ size: "lg" })}>
          Open the community feed
        </Link>
        <Link href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
