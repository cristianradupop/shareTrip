import type { Metadata } from "next";
import type { AuditEventRow } from "server-app/shared";
import { EventTable } from "@/components/admin/event-table";
import { apiGet } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditLogPage() {
  await requireAdmin(); // checked again here: layouts do not protect direct data access
  const { events } = await apiGet<{ events: AuditEventRow[] }>("/api/admin/events?view=audit");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-muted-foreground">
          Latest 300 events of any kind, accounts and trips together. History cannot be edited or deleted.
        </p>
      </div>
      <EventTable events={events} subjectHeading="Account / Trip" />
    </div>
  );
}
