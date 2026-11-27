import type { Metadata } from "next";
import { UserAvatar } from "@/components/user-menu";
import { ProfileForm } from "@/components/joiner/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Profile" };

export default async function JoinerProfilePage() {
  const user = await requireUser();
  const readOnlyDetails: [string, string][] = [
    ["Username", user.username ? `@${user.username}` : "Not set"],
    ["Email address", user.email],
    ["Birth date", user.birthDate || "Not added"],
  ];

  return (
    <div className="space-y-6">
      <header><p className="text-sm font-medium text-primary">Your account</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">My Profile</h1><p className="mt-2 text-sm text-muted-foreground">Your traveler details and contact information.</p></header>
      <section className="max-w-3xl overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-border">
        <div className="flex flex-wrap items-center gap-4 bg-ink p-6 text-white sm:p-8">
          <UserAvatar name={user.name} image={user.image} className="size-20 ring-4 ring-white/15" />
          <div><p className="text-2xl font-semibold">{user.name}</p><p className="mt-1 text-sm text-white/65">TripTogether traveler</p></div>
        </div>
        <div className="space-y-7 p-6 sm:p-8">
          <ProfileForm
            firstName={user.firstName}
            lastName={user.lastName}
            phone={user.phone}
            address={user.address}
            gender={user.gender}
            image={user.image}
          />
          <dl className="divide-y border-t">
            {readOnlyDetails.map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{value}</dd></div>)}
          </dl>
          <p className="text-sm text-muted-foreground">Username and email are read-only to protect your sign-in details.</p>
        </div>
      </section>
    </div>
  );
}
