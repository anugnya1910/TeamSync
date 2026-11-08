"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShellUi } from "./shell-ui-context";
import { useIsMac } from "./topbar";

/** Lists only shortcuts that are implemented in the current phase. */
export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useShellUi();
  const isMac = useIsMac();
  const mod = isMac ? "⌘" : "Ctrl";
  const rows: [string[], string][] = [
    [[mod, "K"], "Open command palette"],
    [["/"], "Search (command palette)"],
    [["?"], "Show keyboard shortcuts"],
    [["G", "H"], "Go to Home"],
    [["G", "M"], "Go to Members"],
    [["Esc"], "Close the topmost dialog or menu"],
  ];
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>More shortcuts (quick create, board navigation) arrive with Projects.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y">
          {rows.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between py-2 text-sm">
              <dt>{label}</dt>
              <dd className="flex gap-1">
                {keys.map((k) => (
                  <kbd key={k} className="min-w-6 rounded border bg-surface-2 px-1.5 py-0.5 text-center font-tabular text-xs">
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
