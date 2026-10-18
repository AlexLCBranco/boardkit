import { readToFrame, type EmbedStatus } from "../domain/embed";
import { embedded, useEmbedStatus } from "../store/embedStore";
import { flushPersist } from "../store/persistBoard";
import { flushPersistRegistry } from "../store/persistRegistry";

/**
 * The frame's side of the canvas protocol (`domain/embed.ts`): says it is
 * ready and how its board stands, reports where it is scrolled (so the
 * canvas can put it back after unloading the frame), and on "flush" saves at
 * once and says whether something is being typed (the canvas then keeps the
 * frame loaded, so an edit in progress is never lost).
 */
const APP = "boardkit";
const SCROLL_REPORT_MS = 150;
const SCROLLER = "[data-board-canvas]";

export function initEmbedBridge(): void {
  const embed = embedded();
  if (!embed || window.parent === window) return;
  const id = embed.id;
  const post = (message: Record<string, unknown>) =>
    window.parent.postMessage({ app: APP, id, ...message }, window.location.origin);

  post({ type: "stone:ready", status: useEmbedStatus.getState().status });
  useEmbedStatus.subscribe((s, prev) => {
    if (s.status !== prev.status) post({ type: "stone:status", status: s.status satisfies EmbedStatus });
  });

  let reportTimer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener(
    "scroll",
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || !el.matches(SCROLLER)) return;
      clearTimeout(reportTimer);
      reportTimer = setTimeout(
        () => post({ type: "stone:scroll", x: el.scrollLeft, y: el.scrollTop }),
        SCROLL_REPORT_MS,
      );
    },
    true,
  );

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const message = readToFrame(event.data);
    if (!message) return;
    if (message.type === "stone:flush") {
      flushPersist();
      flushPersistRegistry();
      post({ type: "stone:flushed", busy: typing() });
      return;
    }
    scrollWhenReady(message.x, message.y);
  });
}

/** The focus in a text field: a title or thots being edited (their drafts
    are the editor's own state until it closes), a composer, the search.
    Unloading now would lose the draft or the place in it. */
function typing(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** The board's scrolling area appears once the board has been drawn; until
    then the request waits, for up to two seconds. */
function scrollWhenReady(x: number, y: number, tries = 120): void {
  const el = document.querySelector<HTMLElement>(SCROLLER);
  if (el) {
    el.scrollTo({ left: x, top: y });
    return;
  }
  if (tries > 0) requestAnimationFrame(() => scrollWhenReady(x, y, tries - 1));
}
