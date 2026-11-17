import { OrganizerShell } from "@/components/organizer/organizer-nav";
import { requireUser } from "@/lib/session";

export default async function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  const user = await requireUser();
  return (
    <OrganizerShell user={{ name: user.name, image: user.image }}>{children}</OrganizerShell>
  );
}
