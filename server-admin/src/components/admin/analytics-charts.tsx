"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { AnalyticsReport } from "server-app/shared";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = {
  visitors: { label: "Visitors", color: "var(--primary)" },
  uniqueIps: { label: "Unique IPs", color: "var(--chart-3)" },
  pageviews: { label: "Page views", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function AnalyticsCharts({ daily }: { daily: AnalyticsReport["daily"] }) {
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={daily} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="visitors" fill="var(--color-visitors)" radius={3} />
        <Bar dataKey="uniqueIps" fill="var(--color-uniqueIps)" radius={3} />
        <Bar dataKey="pageviews" fill="var(--color-pageviews)" radius={3} />
      </BarChart>
    </ChartContainer>
  );
}
