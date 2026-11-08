import { redirect } from "next/navigation";
import { resolveAppEntry } from "@/lib/data/session";

/** Post-login resolver: onboarding, last-visited workspace, or first workspace. */
export default async function AppEntryPage() {
  redirect(await resolveAppEntry());
}
