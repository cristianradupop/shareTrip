import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <div className="flex max-w-md items-center justify-between rounded-2xl border bg-card p-5">
        <div>
          <p className="font-medium">Appearance</p>
          <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
