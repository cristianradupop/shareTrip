import type { Metadata } from "next";
import { UserAvatar } from "@/components/user-menu";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const rows: [string, string][] = [
    ["Username", user.username ?? "-"],
    ["Email", user.email],
    ["Phone", user.phone],
    ["Address", user.address],
    ["Birth date", user.birthDate],
  ];

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      <div className="max-w-xl rounded-2xl border bg-card p-6">
        <div className="mb-6 flex items-center gap-4">
          <UserAvatar name={user.name} image={user.image} className="size-16" />
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.role === "admin" ? "Administrator" : "Traveler"}</p>
          </div>
        </div>
        <dl className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
