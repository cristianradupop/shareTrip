"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminTripRow } from "server-app/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateRange, formatMoney } from "@/lib/format";

const STATUS_BADGE = { active: "outline", full: "secondary", cancelled: "destructive" } as const;

export function TripsTable({
  trips,
  total,
  page,
  pages,
  q,
  status,
}: {
  trips: AdminTripRow[];
  total: number;
  page: number;
  pages: number;
  q: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            go({ q: String(value ?? "").trim() || null, page: null });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search city or organizer…" className="w-72 max-w-full pl-8" />
        </form>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => go({ status: e.target.value || null, page: null })}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="full">Full</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-muted-foreground">{total} {total === 1 ? "trip" : "trips"}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No trips found.
                </TableCell>
              </TableRow>
            )}
            {trips.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.city}, {t.country}
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDateRange(t.departureDate, t.returnDate)}</TableCell>
                <TableCell>
                  <p>{t.organizerName}</p>
                  <p className="text-xs text-muted-foreground">{t.organizerEmail}</p>
                </TableCell>
                <TableCell>
                  {t.members} / {t.maxTravelers}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                </TableCell>
                <TableCell className="min-w-48 whitespace-normal">
                  <details>
                    <summary className="cursor-pointer text-sm text-primary">Show</summary>
                    <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div>Budget: {formatMoney(t.budget, t.currency)}</div>
                      <div>Transport: {t.transport}</div>
                      <div>Gender: {t.gender}</div>
                      <div>Theme: {t.theme}</div>
                    </dl>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} aria-label="Previous page" onClick={() => go({ page: String(page - 1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} aria-label="Next page" onClick={() => go({ page: String(page + 1) })}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
