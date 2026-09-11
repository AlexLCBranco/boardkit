import { useEffect, useRef, useState } from "react";

import styles from "./InlineEditable.module.css";

interface InlineEditableProps {
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

/**
 * A generic click-to-edit text control.
 *
 * It lives in `components/`, not `features/`: it knows nothing about lists or
 * cards, only how to turn a string into an editable field and back. Anything
 * in the app that needs "click text, edit it, Enter to keep it" reuses this
 * rather than growing its own version.
 *
 * Editing state (`isEditing`, `draft`) is local component state, not store
 * state. It is transient and belongs to exactly one component instance --
 * putting it in the store would mean every keystroke writes to Zustand and
 * re-renders every subscriber of that slice, not just this field.
 *
 * The textarea autosizes with a pure-CSS trick rather than a resize
 * listener: an invisible `::after` element in the same grid cell mirrors the
 * typed text via `attr(data-value)`, so the grid row grows to fit it and the
 * textarea (stacked on the same cell) grows with it. No measurement code, no
 * layout thrashing.
 *
 * A `<textarea>` rather than a single-line `<input>`, because a card or list
 * title wraps onto multiple lines once it is long enough -- the editable
 * field needs to wrap the same way the static text does, and only a textarea
 * grows in height to match.
 */
export function InlineEditable({ value, onCommit, ariaLabel, className }: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      const el = textareaRef.current;
      el?.focus();
      el?.select();
    }
  }, [isEditing]);

  function startEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    }
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className={[styles.display, className].filter(Boolean).join(" ")}
        onClick={startEditing}
        aria-label={ariaLabel}
      >
        {value}
      </button>
    );
  }

  return (
    <span className={[styles.autosize, className].filter(Boolean).join(" ")} data-value={draft}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={draft}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        aria-label={ariaLabel}
      />
    </span>
  );
}
