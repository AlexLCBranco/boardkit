import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { StoreApi } from "zustand";

import { Composer } from "../../components/Composer";
import type { BoardId } from "../../domain/types";
import canvasStyles from "../../features/board/BoardCanvas.module.css";
import { BoardDragContext } from "../../features/board/DragContext";
import { ListColumn } from "../../features/board/ListColumn";
import { SelectionBar } from "../../features/board/SelectionBar";
import { useMarqueeSelection } from "../../features/board/useMarqueeSelection";
import { WhiteboardModeContext } from "../../features/board/whiteboardMode";
import { useShortcuts } from "../../features/shortcuts/useShortcuts";
import { BoardStoreContext } from "../../store/boardContext";
import { useBoardStore, type BoardStore } from "../../store/boardStore";
import { useEmbedStatus } from "../../store/embedStore";
import { useIsReadOnly } from "../../store/recoveryStore";
import { useAddListThenItsFirstCard, useListOrder } from "../../store/selectors";
import { onStoredElsewhere, readDisplayBoard, type DisplayBoard } from "./displayStore";
import { onStoredHere, openWhiteboardBoard } from "./history";
import styles from "./WhiteboardBoard.module.css";

/** The app's own shortcuts that are the whiteboard's there: search and help
    (owner, 2026-10-19), and undo/redo, which the whiteboard keeps for the
    whole page in the order things were done (history.ts; owner,
    2026-10-20). */
const APP_SHORTCUTS = ["search.open", "help.open", "history.undo", "history.redo"];

export interface WhiteboardBoardProps {
  readonly boardId: string;
  /** Being edited: Boardkit's own store holds this board, and everything
      on it works as in Boardkit. Otherwise a picture of it, kept current. */
  readonly editing: boolean;
  /** Selected (or edited) on the whiteboard: its slim "+ Add a list" shows
      even without the pointer over it. */
  readonly active?: boolean;
}

/**
 * One Boardkit board on the gauntlet whiteboard: Boardkit's own lists and
 * cards (`ListColumn`, `CardItem`, the drag context, every menu), without
 * the app's toolbar (undo/redo, zoom, search, shortcuts, copy and download
 * the board), at natural size. The whiteboard scales it. No panel or board
 * background behind the lists: they sit on the whiteboard itself, and a
 * background set in Boardkit shows only there (owner, 2026-10-19).
 *
 * Only one board is edited at a time, so the board being edited lives in
 * Boardkit's own store (`openEmbeddedBoard`), with its saving, merging with
 * other tabs, undo, trash and recovery. The others are drawn by the same
 * components from read-only copies of their saved records.
 */
export function WhiteboardBoard({ boardId, editing, active = false }: WhiteboardBoardProps) {
  const id = boardId as BoardId;
  const [display, setDisplay] = useState<DisplayBoard>(() => readDisplayBoard(id));
  const displayStore = useRef<StoreApi<BoardStore> | null>(display.store);

  // A picture follows every save: another tab's, and this page's own
  // editing (read again when editing ends, after its save is flushed).
  useEffect(() => {
    const reread = () => {
      const next = readDisplayBoard(id, displayStore.current);
      displayStore.current = next.store;
      setDisplay(next);
    };
    if (!editing) reread();
    const stopElsewhere = onStoredElsewhere((stored) => {
      if (stored === id) reread();
    });
    // This page storing it while it is not edited: an undo from the page.
    const stopHere = onStoredHere((stored) => {
      if (stored === id && !editing) reread();
    });
    return () => {
      stopElsewhere();
      stopHere();
    };
  }, [id, editing]);

  if (editing) return <EditingBoard boardId={id} active={active} />;
  if (display.status !== "ok" && display.status !== "newer") return <Problem status={display.status} />;
  return (
    <BoardStoreContext.Provider value={display.store}>
      <BoardFrame editing={false} active={active} />
    </BoardStoreContext.Provider>
  );
}

function EditingBoard({ boardId, active }: { readonly boardId: BoardId; readonly active: boolean }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    openWhiteboardBoard(boardId);
    setOpened(true);
  }, [boardId]);
  const status = useEmbedStatus((s) => s.status);
  const shownId = useBoardStore((s) => s.boardId);
  if (!opened || shownId !== boardId) return null;
  if (status !== "ok") return <Problem status="missing" />;
  return <BoardFrame editing active={active} />;
}

function BoardFrame({ editing, active }: { readonly editing: boolean; readonly active: boolean }) {
  const listOrder = useListOrder();
  const readOnly = useIsReadOnly();
  const marqueeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const handlePointerDown = useMarqueeSelection(marqueeRef);
  usePointerOverMarks(rootRef);
  useLastListHeight(rootRef);
  return (
    <WhiteboardModeContext.Provider value={true}>
      <div
        ref={rootRef}
        className={styles.board}
        data-boardkit-board=""
        data-editing={editing ? "true" : "false"}
        data-active={active ? "" : undefined}
        onPointerDown={editing ? handlePointerDown : undefined}
      >
        {editing && <Shortcuts />}
        <BoardDragContext overlayToBody>
          <div className={styles.rail} inert={!editing || readOnly}>
            <SortableContext items={[...listOrder]} strategy={horizontalListSortingStrategy}>
              {listOrder.map((listId) => (
                <ListColumn key={listId} listId={listId} />
              ))}
            </SortableContext>
            <AddListSlot slim={listOrder.length > 0} />
          </div>
        </BoardDragContext>
        {/* Fixed to the window, so drawn at the page's top level: inside the
            whiteboard's transforms "fixed" would mean fixed to the whiteboard. */}
        {editing &&
          createPortal(
            <>
              <div ref={marqueeRef} className={canvasStyles.marquee} aria-hidden="true" />
              <SelectionBar />
            </>,
            document.body,
          )}
      </div>
    </WhiteboardModeContext.Provider>
  );
}

/** The last list's height, as `--last-list-height` on the board, for the
    "+ Add a list" ghost column beside it (WhiteboardBoard.module.css). */
function useLastListHeight(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const lists = root.querySelectorAll<HTMLElement>("section[data-list-id]");
      const last = lists[lists.length - 1];
      if (last) root.style.setProperty("--last-list-height", `${last.offsetHeight}px`);
    };
    measure();
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      for (const list of root.querySelectorAll("section[data-list-id]")) sizes.observe(list);
      measure();
    };
    // Lists come and go (added, deleted, reordered): watch the new last one.
    const isList = (n: Node) => n instanceof HTMLElement && n.matches("section[data-list-id]");
    const lists = new MutationObserver((changes) => {
      if (changes.some((c) => [...c.addedNodes, ...c.removedNodes].some(isList))) watch();
    });
    lists.observe(root, { childList: true, subtree: true });
    watch();
    return () => {
      sizes.disconnect();
      lists.disconnect();
    };
  }, [rootRef]);
}

/** How far around the board (screen pixels) the pointer still counts as
    over it: its name above, its slim "+" buttons just outside. */
const AROUND = { top: 36, right: 56, bottom: 16, left: 8 };

/** Where the pointer was last seen, for a board drawn anew under it (e.g.
    when editing starts: a press on a slim "+" must find it still showing). */
let lastPointer: { readonly x: number; readonly y: number } | null = null;

/**
 * Marks where the pointer is, for what shows only on hover
 * (WhiteboardBoard.module.css, ListColumn.module.css): `data-pointer-over`
 * on the board and on the list it is over, `data-pointer-over-header` on
 * that list when it is over its header. Worked out from the pointer's
 * position, not CSS :hover, since a board not being edited ignores the
 * pointer (the whiteboard selects and moves it as a whole).
 */
function usePointerOverMarks(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mark = (el: Element, name: string, on: boolean) => {
      if (el.hasAttribute(name) !== on) el.toggleAttribute(name, on);
    };
    let over = false;
    const clear = () => {
      if (!over) return;
      over = false;
      mark(root, "data-pointer-over", false);
      for (const el of root.querySelectorAll("[data-pointer-over], [data-pointer-over-header]")) {
        el.removeAttribute("data-pointer-over");
        el.removeAttribute("data-pointer-over-header");
      }
    };
    const place = (x: number, y: number) => {
      const r = root.getBoundingClientRect();
      if (x < r.left - AROUND.left || x > r.right + AROUND.right || y < r.top - AROUND.top || y > r.bottom + AROUND.bottom) {
        clear();
        return;
      }
      over = true;
      mark(root, "data-pointer-over", true);
      for (const list of root.querySelectorAll("section[data-list-id]")) {
        const l = list.getBoundingClientRect();
        const onList = x >= l.left && x <= l.right && y >= l.top && y <= l.bottom;
        const h = list.querySelector("[data-list-header]")?.getBoundingClientRect();
        mark(list, "data-pointer-over", onList);
        mark(list, "data-pointer-over-header", onList && !!h && y >= h.top && y <= h.bottom);
      }
    };
    const onMove = (event: PointerEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      place(event.clientX, event.clientY);
    };
    if (lastPointer) place(lastPointer.x, lastPointer.y);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", clear);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", clear);
    };
  }, [rootRef]);
}

function Shortcuts() {
  useShortcuts(APP_SHORTCUTS);
  return null;
}

/** "+ Add a list"; with lists already there, a slim "+" on the last
    list's right edge that takes no room (shown on hover or while the board
    is selected). */
function AddListSlot({ slim }: { readonly slim: boolean }) {
  const addList = useAddListThenItsFirstCard();
  return (
    <div className={slim ? styles.addListSlim : canvasStyles.addListSlot} data-capture-exclude="true">
      <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} adds="list" slim={slim} closeAfterSubmit />
    </div>
  );
}

function Problem({ status }: { readonly status: "missing" | "damaged" | "newer" }) {
  const why = {
    missing: "This board isn’t in Boardkit any more.",
    damaged: "This board needs repairing: open it in Boardkit (/boardkit).",
    newer: "This board was saved by a newer Boardkit. Reload the page.",
  }[status];
  return (
    <div className={`${styles.board} ${styles.problem}`} data-boardkit-board="" data-status={status}>
      <p>{why}</p>
    </div>
  );
}
