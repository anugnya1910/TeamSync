import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Inbox } from "@/components/notifications/inbox";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" description="Notifications for this workspace. Choose which types you get in Settings → Notifications." />
      <Inbox />
    </>
  );
}
