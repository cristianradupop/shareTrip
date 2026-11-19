import type { Metadata } from "next";
import type { AdminTripRow } from "server-app/shared";
import { TripsTable } from "@/components/admin/trips-table";
import { apiGet } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Trips" };

const STATUSES = ["active", "full", "cancelled"];

export default async function AdminTripsPage({ searchParams }: PageProps<"/admin/trips">) {
  await requireAdmin(); // checked again here: layouts do not protect direct data access
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  const data = await apiGet<{ trips: AdminTripRow[]; total: number; page: number; pageSize: number }>(
    `/api/admin/trips?${query}`,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trips</h1>
        <p className="mt-1 text-muted-foreground">Every trip on the platform. Read only.</p>
      </div>
      <TripsTable
        trips={data.trips}
        total={data.total}
        page={data.page}
        pages={Math.max(1, Math.ceil(data.total / data.pageSize))}
        q={q}
        status={status}
      />
    </div>
  );
}
