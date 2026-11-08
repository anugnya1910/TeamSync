"use client";

import { Maximize2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseTaskKey } from "@/lib/utils/task-key";
import { TaskDetail } from "./task-detail";

const mq = "(min-width: 768px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(mq);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(mq).matches,
    () => true,
  );
}

/** Builds a URL that opens a task in the side sheet while keeping the current view & filters. */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (key: string | null) => {
      const p = new URLSearchParams(params.toString());
      if (key) p.set("task", key);
      else p.delete("task");
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
}

/**
 * Task detail as a right Sheet (desktop, 640 px) or full-screen Drawer (mobile), driven by the
 * `?task=KEY-n` search param so the board/list context is preserved and the URL is shareable.
 */
export function TaskSheetController() {
  const params = useSearchParams();
  const { project } = useProject();
  const { workspace } = useWorkspace();
  const open = useOpenTask();
  const desktop = useIsDesktop();
  const parsed = parseTaskKey(params.get("task") ?? "");
  const valid = parsed && parsed.projectKey === project.key ? parsed : null;
  const close = () => open(null);
  const fullHref = valid ? `/w/${workspace.slug}/t/${project.key}-${valid.number}` : "#";

  const body = valid ? <TaskDetail number={valid.number} onClosed={close} /> : null;

  if (desktop) {
    return (
      <Sheet open={Boolean(valid)} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[640px]">
          <SheetHeader className="flex-row items-center gap-2 border-b pb-3">
            <SheetTitle className="font-tabular text-sm">{valid ? `${project.key}-${valid.number}` : "Task"}</SheetTitle>
            <SheetDescription className="sr-only">Task details</SheetDescription>
            <Button asChild variant="ghost" size="icon-sm" className="ml-auto mr-8" aria-label="Open full page">
              <Link href={fullHref}>
                <Maximize2 className="size-4" aria-hidden />
              </Link>
            </Button>
          </SheetHeader>
          <div className="px-4 pb-8">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={Boolean(valid)} onOpenChange={(o) => !o && close()}>
      <DrawerContent className="max-h-[96dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-tabular text-sm">{valid ? `${project.key}-${valid.number}` : "Task"}</DrawerTitle>
          <DrawerDescription className="sr-only">Task details</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
