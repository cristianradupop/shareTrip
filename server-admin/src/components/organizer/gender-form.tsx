"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientFetch } from "@/lib/client-api";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Lets an account without a gender (or with a wrong one) set it. */
export function GenderForm({ current }: { current: "male" | "female" | null }) {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value) return;
    setSaving(true);
    const result = await clientFetch("/api/profile", { method: "PATCH", json: { gender: value } });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Gender saved");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Select items={GENDERS} value={value} onValueChange={setValue}>
        <SelectTrigger className="w-36" aria-label="Gender">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {GENDERS.map((g) => (
            <SelectItem key={g.value} value={g.value}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={save} disabled={saving || !value || value === current}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
