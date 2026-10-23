import styles from "./LinkIcon.module.css";

/**
 * The small link icon on a card, list or board that holds a link. It is the
 * only way to open the link (in a new tab, `noopener`): a click on the card
 * itself still does what it always did. A plain `<a>`, so the browser's own
 * new-tab, copy-link and status-bar handling all work.
 *
 * Presses stop here, so they never start a drag of the card or list under
 * it. `data-link-open` marks it for the gauntlet whiteboard, which opens it
 * from a board that is only being shown (that board ignores the pointer).
 */
export function LinkIcon({ url, className }: { readonly url: string; readonly className?: string }) {
  return (
    <a
      className={[styles.icon, className].filter(Boolean).join(" ")}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      aria-label={`Open link: ${url}`}
      data-link-open=""
      data-capture-exclude="true"
      draggable={false}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </a>
  );
}
