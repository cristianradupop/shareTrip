import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <ComingSoon title="Messages" text="Trip group chats are created when travelers join a trip. They arrive with the Joiner part." />;
}
