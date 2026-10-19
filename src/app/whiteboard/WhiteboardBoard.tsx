import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import type { StoreApi } from "zustand";

import { Composer } from "../../components/Composer";
import type { BoardId } from "../../domain/types";
import { BoardBackdrop } from "../../features/board/BoardBackdrop";
import canvasStyles from "../../features/board/BoardCanvas.module.css";
import { BoardDragContext } from "../../features/board/DragContext";
import { ListColumn } from "../../features/board/ListColumn";
import { SelectionBar } from "../../features/board/SelectionBar";
import { useBackgroundChrome } from "../../features/board/useBoardBackdrop";
import { useMarqueeSelection } from "../../features/board/useMarqueeSelection";
import { useShortcuts } from "../../features/shortcuts/useShortcuts";
import { BoardStoreContext } from "../../store/boardContext";
import { openEmbeddedBoard, useBoardStore, type BoardStore } from "../../store/boardStore";
import { useEmbedStatus } from "../../store/embedStore";
import { useIsReadOnly } from "../../store/recoveryStore";
import { useAddList, useListOrder } from "../../store/selectors";
import { onStoredElsewhere, readDisplayBoard, type DisplayBoard } from "./displayStore";
import styles from "./WhiteboardBoard.module.css";

/** The app's own shortcuts that belong to its toolbar, not to a board: the
    whiteboard has its own search and help (owner, 2026-10-19). Undo and redo
    stay: while a board is being edited they undo its card edits. */
const APP_SHORTCUTS = ["search.open", "help.open"];

export interface WhiteboardBoardProps {
  readonly boardId: string;
  /** Being edited: Boardkit's own store holds this board, and everything
      on it works as in Boardkit. Otherwise a picture of it, kept current. */
  readonly editing: boolean;
}

/**
 * One Boardkit board on the gauntlet whiteboard: Boardkit's own lists and
 * cards (`ListColumn`, `CardItem`, the drag context, every menu), without
 * the app's toolbar (undo/redo, zoom, search, shortcuts, copy and download
 * the board), at natural size. The whiteboard scales it.
 *
 * Only one board is edited at a time, so the board being edited lives in
 * Boardkit's own store (`openEmbeddedBoard`), with its saving, merging with
 * other tabs, undo, trash and recovery. The others are drawn by the same
 * components from read-only copies of their saved records.
 */
export function WhiteboardBoard({ boardId, editing }: WhiteboardBoardProps) {
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
    return onStoredElsewhere((stored) => {
      if (stored === id) reread();
    });
  }, [id, editing]);

  if (editing) return <EditingBoard boardId={id} />;
  if (display.status !== "ok" && display.status !== "newer") return <Problem status={display.status} />;
  return (
    <BoardStoreContext.Provider value={display.store}>
      <BoardFrame editing={false} />
    </BoardStoreContext.Provider>
  );
}

function EditingBoard({ boardId }: { readonly boardId: BoardId }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    openEmbeddedBoard(boardId);
    setOpened(true);
  }, [boardId]);
  const status = useEmbedStatus((s) => s.status);
  const shownId = useBoardStore((s) => s.boardId);
  if (!opened || shownId !== boardId) return null;
  if (status !== "ok") return <Problem status="missing" />;
  return <BoardFrame editing />;
}

function BoardFrame({ editing }: { readonly editing: boolean }) {
  const listOrder = useListOrder();
  const readOnly = useIsReadOnly();
  const marqueeRef = useRef<HTMLDivElement>(null);
  const handlePointerDown = useMarqueeSelection(marqueeRef);
  return (
    <div
      className={styles.board}
      data-boardkit-board=""
      data-editing={editing ? "true" : "false"}
      onPointerDown={editing ? handlePointerDown : undefined}
    >
      <BoardBackdrop />
      {editing && <Shortcuts />}
      <BoardDragContext>
        <div className={styles.rail} inert={!editing || readOnly}>
          <SortableContext items={[...listOrder]} strategy={horizontalListSortingStrategy}>
            {listOrder.map((listId) => (
              <ListColumn key={listId} listId={listId} />
            ))}
          </SortableContext>
          <AddListSlot />
        </div>
      </BoardDragContext>
      {editing && (
        <>
          <div ref={marqueeRef} className={canvasStyles.marquee} aria-hidden="true" />
          <SelectionBar />
        </>
      )}
    </div>
  );
}

function Shortcuts() {
  useShortcuts(APP_SHORTCUTS);
  return null;
}

function AddListSlot() {
  const addList = useAddList();
  const chrome = useBackgroundChrome();
  return (
    <div
      className={canvasStyles.addListSlot}
      data-scheme={chrome?.scheme}
      data-ink={chrome?.ink}
      data-capture-exclude="true"
    >
      <Composer label="Add a list" placeholder="Enter list title…" onSubmit={addList} />
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
