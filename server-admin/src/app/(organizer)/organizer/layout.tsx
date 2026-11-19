import { OrganizerShell } from "@/components/organizer/organizer-nav";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { OrganizerStats } from "server-app/shared";

export default async function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  const user = await requireUser();
  // The badge is optional: a failing stats call must not break the organizer pages.
  const pendingRequests = await apiGet<{ stats: OrganizerStats }>("/api/organizer/stats")
    .then((r) => r.stats.pendingRequests)
    .catch(() => 0);
  return (
    <OrganizerShell user={{ name: user.name, image: user.image }} pendingRequests={pendingRequests}>
      {children}
    </OrganizerShell>
  );
}
