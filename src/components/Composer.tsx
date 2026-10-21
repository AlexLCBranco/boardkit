import { useEffect, useLayoutEffect, useRef, useState } from "react";

import styles from "./Composer.module.css";
import { useClickAway } from "./useClickAway";

/** How a title was given: Enter (or the Add button), or a click away. */
export type SubmitHow = "enter" | "away";

interface ComposerProps {
  readonly label: string;
  readonly placeholder?: string;
  readonly onSubmit: (title: string, how: SubmitHow) => void;
  /** What it adds, as a fixed marker (`data-add`) on the button, for code
      that must find it whatever its text (the gauntlet whiteboard). */
  readonly adds?: "list" | "card";
  /** The button is a slim "+" (labelled for screen readers), placed by the
      caller's CSS (`data-slim`); open, the field is the usual one. */
  readonly slim?: boolean;
  /** Closes after Enter adds, instead of staying open for the next one
      (the add-a-list field: the new list's card field opens instead). */
  readonly closeAfterSubmit?: boolean;
  /** Opens it now, focused (`onOpenedNow` then clears the request). Opened
      this way, Enter on an empty field closes it rather than adding a
      blank one. */
  readonly openNow?: boolean;
  readonly onOpenedNow?: () => void;
}

/**
 * The add-a-card and add-a-list input. One component, reused for both: a
 * collapsed trigger button that expands into a textarea on click.
 *
 * Submitting on Enter clears the draft but keeps the field open and focused,
 * so adding five cards in a row is five Enter presses, not five clicks. It
 * can do this without a layout jump because it never remounts -- the same
 * textarea node just has more siblings above it as the list grows, and focus
 * stays with the DOM node React keeps re-using.
 *
 * Each Enter also scrolls the composer back into view. The new card lands
 * above it and pushes it down, and a focused field doesn't follow its own
 * layout shifts, so without this a full-height list would leave the field --
 * and the cards being typed -- below the fold.
 *
 * A click away (or the field losing focus) adds what was typed, as Enter
 * does, and closes it (owner, 2026-10-21: typed text is never lost); with
 * nothing typed it only closes, so a stray click leaves no blank card or
 * list. Escape closes it and discards the draft. Enter may add a blank one.
 */
export function Composer({ label, placeholder, onSubmit, adds, slim = false, closeAfterSubmit = false, openNow = false, onOpenedNow }: ComposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Opened by `openNow`: an empty Enter closes it.
  const [emptyCloses, setEmptyCloses] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitCount, setSubmitCount] = useState(0);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Set once a click away has added or closed, so the blur that follows the
  // same press does nothing more.
  const awayRef = useRef(false);

  // Runs in the same commit as the new card (the store write and this state
  // change are batched), so the layout it measures already includes the card.
  // `nearest` scrolls only as far as needed, and not at all if already visible.
  useLayoutEffect(() => {
    if (submitCount > 0) {
      composerRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [submitCount]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

      useEffect(() => {
    if (!openNow) return;
    awayRef.current = false;
    setDraft("");
    setIsOpen(true);
    setEmptyCloses(true);
    textareaRef.current?.focus();
    onOpenedNow?.();
  }, [openNow, onOpenedNow]);

  function open() {
    awayRef.current = false;
    setDraft("");
    setEmptyCloses(false);
    setIsOpen(true);
  }

  function close() {
    awayRef.current = true;
    setIsOpen(false);
    setEmptyCloses(false);
    setDraft("");
  }

  function submit() {
    if (emptyCloses && draft.trim() === "") {
      close();
      return;
    }
    // A blank title is allowed: Enter on an empty field adds an empty card
    // or list. Escape, blur and × are how you close without adding.
    onSubmit(draft.trim(), "enter");
    if (closeAfterSubmit) {
      close();
      return;
    }
    setDraft("");
    setSubmitCount((count) => count + 1);
    textareaRef.current?.focus();
  }

  /** A click away: what was typed is added, as Enter does; nothing typed,
      nothing added. Either way it closes. */
  function away() {
    if (awayRef.current) return;
    const title = draft.trim();
    if (title) onSubmit(title, "away");
    close();
  }
  useClickAway(composerRef, isOpen, away);

  if (!isOpen) {
    if (slim) {
      return (
        <button type="button" className={styles.slim} onClick={open} data-add={adds} data-slim="" aria-label={label} title={label}>
          +
        </button>
      );
    }
    return (
      <button type="button" className={styles.trigger} onClick={open} data-add={adds}>
        + {label}
      </button>
    );
  }

  return (
    <div ref={composerRef} className={styles.composer}>
      <span className={styles.autosize} data-value={draft}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={draft}
          placeholder={placeholder}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={away}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          aria-label={label}
        />
      </span>
      <div className={styles.actions}>
        {/* preventDefault on mousedown stops the textarea's blur (which
            would close the composer) from firing before the click handler
            below gets a chance to run. */}
        <button
          type="button"
          className={styles.submit}
          onMouseDown={(event) => event.preventDefault()}
          onClick={submit}
        >
          Add
        </button>
        <button
          type="button"
          className={styles.cancel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={close}
          aria-label="Cancel"
        >
          ×
        </button>
      </div>
    </div>
  );
}
