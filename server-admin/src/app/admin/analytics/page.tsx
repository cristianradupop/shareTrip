import type { Metadata } from "next";
import Link from "next/link";
import { ANALYTICS_RANGES, type AnalyticsRange, type AnalyticsReport } from "server-app/shared";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const RANGE_LABELS: Record<AnalyticsRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };
const RATING_LABELS = { good: "Good", "needs-improvement": "Needs improvement", poor: "Poor" } as const;

function parseRange(value: string | string[] | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.find((r) => r === value) ?? "7d";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

function formatVital(name: string, value: number | null): string {
  if (value === null) return "-";
  return name === "CLS" ? value.toFixed(3) : `${Math.round(value)} ms`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No data for this range.</p>;
}

function CountTable({ rows, label }: { rows: { label: string; count: number }[]; label: string }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            <TableHead className="text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="max-w-xs truncate">{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  await requireAdmin(); // checked again here: layouts do not protect direct data access
  const range = parseRange((await searchParams).range);
  const r = await apiGet<AnalyticsReport>(`/api/admin/analytics?range=${range}`);

  const tiles: [string, string][] = [
    ["Page views", String(r.totals.pageviews)],
    ["Sessions", String(r.totals.sessions)],
    ["Unique visitors", String(r.totals.visitors)],
    ["Signed-in share", `${Math.round(r.totals.signedInShare * 100)}%`],
    ["Average time on page", formatDuration(r.totals.avgDurationMs)],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">First-party visits from people who accepted analytics.</p>
        </div>
        <nav aria-label="Range" className="flex gap-1">
          {ANALYTICS_RANGES.map((value) => (
            <Link
              key={value}
              href={`/admin/analytics?range=${value}`}
              aria-current={value === range ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                value === range ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABELS[value]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <Section title="Visitors and page views per day">
        {r.daily.length === 0 ? (
          <Empty />
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <AnalyticsCharts daily={r.daily} />
          </div>
        )}
      </Section>

      <Section title="Top pages">
        {r.topPages.length === 0 ? (
          <Empty />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Average time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.topPages.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell className="max-w-xs truncate">{p.path}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.visitors}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(p.avgDurationMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Top clicked elements">
          <CountTable rows={r.clicks} label="Element" />
        </Section>
        <Section title="Interactions">
          <CountTable rows={r.interactions} label="Interaction" />
        </Section>
      </div>

      <Section title="API latency">
        {r.api.length === 0 ? (
          <Empty />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">p50</TableHead>
                  <TableHead className="text-right">p95</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.api.map((a) => (
                  <TableRow key={`${a.method} ${a.apiPath}`}>
                    <TableCell className="max-w-xs truncate">{a.method} {a.apiPath}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.calls}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.errors}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(a.p50Ms)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(a.p95Ms)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Web Vitals (75th percentile)">
        {r.vitals.every((v) => v.samples === 0) ? (
          <Empty />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">p75</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.vitals.map((v) => (
                  <TableRow key={v.name}>
                    <TableCell>{v.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.samples}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatVital(v.name, v.p75)}</TableCell>
                    <TableCell>{v.rating ? RATING_LABELS[v.rating] : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-3">
        <Section title="Devices">
          <CountTable rows={r.devices} label="Device" />
        </Section>
        <Section title="Browsers">
          <CountTable rows={r.browsers} label="Browser" />
        </Section>
        <Section title="Top referrers">
          <CountTable rows={r.referrers} label="Referrer" />
        </Section>
      </div>
    </div>
  );
}
