import { ComingSoon } from "@/components/brand/coming-soon";
import { PRIMARY_NAV, SETTINGS_NAV, type NavKey } from "@/lib/navigation";
import { PageHeader } from "./page-header";

/** Shared page for later-phase routes: explains what the page will show and when. */
export function PhasePlaceholderPage({ navKey, slug }: { navKey: NavKey; slug: string }) {
  const item = [...PRIMARY_NAV, SETTINGS_NAV].find((n) => n.key === navKey);
  if (!item) return null;
  const phase = (item.phase === 1 ? 2 : item.phase) as 2 | 3 | 4;
  return (
    <>
      <PageHeader title={item.label} />
      <div className="rounded-2xl border bg-card">
        <ComingSoon
          phase={phase}
          icon={item.icon}
          title={`${item.label} is on the way`}
          description={item.description}
          backHref={`/w/${slug}`}
        />
      </div>
    </>
  );
}
