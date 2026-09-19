import { useRef, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";

interface NewBoardDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Pre-filled so pressing Enter straight away still works. */
  readonly defaultName: string;
  readonly onCreate: (name: string) => void;
}

/**
 * Asks for a name before a board is created, instead of creating an
 * "Untitled board N" and leaving the user to rename it.
 *
 * The form lives in its own component because `DialogContent` unmounts when
 * the dialog closes: `useState` there re-initialises from `defaultName` on
 * every open, so no reset effect is needed.
 */
export function NewBoardDialog({ open, onOpenChange, defaultName, onCreate }: NewBoardDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Radix would focus the first focusable element; do it ourselves so
        // the pre-filled name is also selected and typing replaces it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      >
        <NewBoardForm
          inputRef={inputRef}
          defaultName={defaultName}
          onCancel={() => onOpenChange(false)}
          onSubmit={(name) => {
            onCreate(name);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NewBoardFormProps {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly defaultName: string;
  readonly onCancel: () => void;
  readonly onSubmit: (name: string) => void;
}

function NewBoardForm({ inputRef, defaultName, onCancel, onSubmit }: NewBoardFormProps) {
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>New board</DialogTitle>
        <DialogDescription>Give your new board a name.</DialogDescription>
      </DialogHeader>
      <Input
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Board name"
        placeholder="Board name"
        maxLength={80}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed}>
          Create board
        </Button>
      </DialogFooter>
    </form>
  );
}
