import { KeyboardIcon } from "lucide-react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Kbd, KbdGroup } from "../../components/ui/kbd";

type ShortcutEntry = {
  keys: string[];
  description: string;
};

type ShortcutGroup = {
  title: string;
  entries: ShortcutEntry[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "History",
    entries: [
      { keys: ["Ctrl", "Z"], description: "Undo the last board change" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
    ],
  },
  {
    title: "Editing",
    entries: [
      { keys: ["Enter"], description: "Commit a rename, or submit a new card or list" },
      { keys: ["Shift", "Enter"], description: "Insert a line break in a description" },
      { keys: ["Esc"], description: "Cancel an edit, or close the open panel" },
    ],
  },
  {
    title: "Drag and drop",
    entries: [
      { keys: ["Tab"], description: "Focus a card or list to move it by keyboard" },
      { keys: ["Space"], description: "Pick up or drop the focused card or list" },
      { keys: ["←", "→", "↑", "↓"], description: "Move the picked-up card or list" },
    ],
  },
  {
    title: "Resizing lists (drag a list's right edge)",
    entries: [
      { keys: ["Drag"], description: "Resize this list" },
      { keys: ["Double-click"], description: "Fit this list to its widest card" },
      { keys: ["Alt", "Drag"], description: "Resize every list by the same amount" },
      { keys: ["Alt", "Double-click"], description: "Fit every list to its own cards" },
      { keys: ["Shift", "Drag"], description: "Resize every list to match this one" },
      { keys: ["Shift", "Double-click"], description: "Match every list's width to this one" },
    ],
  },
];

const CONTEXT_MENU_ENTRIES: ShortcutEntry[] = [
  { keys: ["Right-click"], description: "Toggle a card's thots section open or closed" },
];

/**
 * A read-only reference for every keyboard shortcut and right-click action
 * in the app. Nothing here is executable from the dialog itself -- unlike a
 * command palette, it does not run actions, so it stays out of the "not
 * being built" list in PLAN.md.
 */
export function ShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <ShortcutList key={group.title} title={group.title} entries={group.entries} />
          ))}
          <ShortcutList title="Right-click" entries={CONTEXT_MENU_ENTRIES} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutList({ title, entries }: ShortcutGroup) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li key={entry.description} className="flex items-center justify-between gap-4">
            <span className="text-foreground">{entry.description}</span>
            <KbdGroup>
              {entry.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </li>
        ))}
      </ul>
    </div>
  );
}
