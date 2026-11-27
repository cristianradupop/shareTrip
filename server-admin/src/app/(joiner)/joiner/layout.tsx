import { JoinerShell } from "@/components/joiner/joiner-nav";
import { requireUser } from "@/lib/session";

export default async function JoinerLayout({ children }: LayoutProps<"/joiner">) {
  const user = await requireUser();
  return (
    <JoinerShell user={{ name: user.name, firstName: user.firstName, username: user.username, image: user.image }}>
      {children}
    </JoinerShell>
  );
}
