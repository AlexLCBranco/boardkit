import { KeyboardIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Kbd, KbdGroup } from "../../components/ui/kbd";
import { useIsShortcutsDialogOpen, useSetShortcutsDialogOpen } from "../../store/selectors";
import { formatCombo } from "./keys";
import { SHORTCUTS, type Scope } from "./registry";

/** One row: what it does, and one or more alternative key combos for it. */
type Row = {
  readonly description: string;
  readonly combos: readonly (readonly string[])[];
};

type Group = {
  readonly title: string;
  readonly rows: readonly Row[];
};

const SCOPE_TITLES: Readonly<Record<Scope, string>> = {
  global: "Anywhere",
  card: "With a card focused (Tab or arrow keys to focus one)",
  list: "With a list's header focused",
};

/** Generated from the registry, so this can never list a key that does not
    work or miss one that does. */
const REGISTRY_GROUPS: readonly Group[] = (Object.keys(SCOPE_TITLES) as Scope[]).map((scope) => ({
  title: SCOPE_TITLES[scope],
  rows: SHORTCUTS.filter((shortcut) => shortcut.scope === scope).map((shortcut) => ({
    description: shortcut.label,
    combos: shortcut.combos.map(formatCombo),
  })),
}));

// What follows is not in the registry, because none of it is a shortcut the
// app dispatches: keys that belong to a text field, to dnd-kit's own keyboard
// drag, or gestures with a mouse.
const OTHER_GROUPS: readonly Group[] = [
  {
    title: "While typing",
    rows: [
      { description: "Commit a rename, or submit a new card or list", combos: [["Enter"]] },
      { description: "Insert a line break in a description", combos: [["Shift", "Enter"]] },
      { description: "Cancel an edit, or close the open panel", combos: [["Esc"]] },
    ],
  },
  {
    title: "Moving by keyboard",
    rows: [
      { description: "Pick up or drop the focused card or list", combos: [["Space"]] },
      { description: "Move the picked-up card or list", combos: [["←", "→", "↑", "↓"]] },
      { description: "Put it back", combos: [["Esc"]] },
    ],
  },
  {
    title: "Mouse: selecting cards (drag on empty space)",
    rows: [
      { description: "Draw a box to select every card it touches", combos: [["Drag"]] },
      { description: "Add to the current selection", combos: [["Shift", "Drag"]] },
    ],
  },
  {
    title: "Mouse: resizing lists (drag a list's right edge)",
    rows: [
      { description: "Resize this list", combos: [["Drag"]] },
      { description: "Fit this list to its widest card", combos: [["Double-click"]] },
      { description: "Resize every list by the same amount", combos: [["Alt", "Drag"]] },
      { description: "Fit every list to its own cards", combos: [["Alt", "Double-click"]] },
      { description: "Resize every list to match this one", combos: [["Shift", "Drag"]] },
      { description: "Match every list's width to this one", combos: [["Shift", "Double-click"]] },
    ],
  },
  {
    title: "Mouse: right-click",
    rows: [
      { description: "Toggle a card's thots section open or closed", combos: [["Right-click"]] },
      { description: "Duplicate a list (right-click its header)", combos: [["Right-click"]] },
    ],
  },
];

/**
 * A read-only reference for every keyboard shortcut and mouse gesture in the
 * app. The keyboard part is generated from the shortcut registry; nothing
 * here is executable from the dialog itself -- unlike a command palette, it
 * does not run actions, so it stays out of the "not being built" list in
 * PLAN.md.
 *
 * Its open state lives in a store so the `?` shortcut can open it as well as
 * the toolbar button.
 */
export function ShortcutsDialog() {
  const isOpen = useIsShortcutsDialogOpen();
  const setOpen = useSetShortcutsDialogOpen();

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {[...REGISTRY_GROUPS, ...OTHER_GROUPS].map((group) => (
            <ShortcutList key={group.title} group={group} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutList({ group }: { readonly group: Group }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
      <ul className="flex flex-col gap-1.5">
        {group.rows.map((row) => (
          <li key={row.description} className="flex items-center justify-between gap-4">
            <span className="text-foreground">{row.description}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {row.combos.map((combo, index) => (
                <Fragment key={combo.join("+")}>
                  {index > 0 && <span className="text-xs text-muted-foreground">or</span>}
                  <KbdGroup>
                    {combo.map((cap) => (
                      <Kbd key={cap}>{cap}</Kbd>
                    ))}
                  </KbdGroup>
                </Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
