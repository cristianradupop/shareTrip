import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { listUsers } from "@/data/users";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Manage users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin(); // checked again here: layouts do not protect direct data access
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const { users, total, pages } = await listUsers({ q, page });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage users</h1>
        <p className="mt-1 text-muted-foreground">Create, edit, ban or remove accounts.</p>
      </div>
      <UsersTable users={users} total={total} page={Math.min(page, pages)} pages={pages} q={q} currentUserId={admin.id} />
    </div>
  );
}
