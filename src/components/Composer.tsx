import { useEffect, useRef, useState } from "react";

import styles from "./Composer.module.css";

interface ComposerProps {
  readonly label: string;
  readonly placeholder?: string;
  readonly onSubmit: (title: string) => void;
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
 * Escape or blur closes the composer and discards the draft. Only Enter (or
 * the Add button) creates something, so a stray click elsewhere can't leave
 * behind an accidental card.
 */
export function Composer({ label, placeholder, onSubmit }: ComposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  function open() {
    setDraft("");
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setDraft("");
  }

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      close();
      return;
    }
    onSubmit(trimmed);
    setDraft("");
    textareaRef.current?.focus();
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.trigger} onClick={open}>
        + {label}
      </button>
    );
  }

  return (
    <div className={styles.composer}>
      <span className={styles.autosize} data-value={draft}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={draft}
          placeholder={placeholder}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={close}
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
