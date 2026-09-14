import { BoardCanvas } from "../features/board/BoardCanvas";
import { BoardSwitcher } from "../features/board/BoardSwitcher";
import { TrashPanel } from "../features/board/TrashPanel";
import styles from "./App.module.css";
import { VersionBadge } from "./VersionBadge";

/**
 * App owns the page chrome only: a header and the scroll container the board
 * lives in. It deliberately knows nothing about lists or cards -- `BoardSwitcher`
 * owns the board's name and which one is active, not `App` itself -- so the
 * board can later be embedded elsewhere (a modal, a split view) without
 * changes here.
 */
export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <BoardSwitcher />
        <TrashPanel />
      </header>
      <main className={styles.main}>
        <BoardCanvas />
      </main>
      <VersionBadge />
    </div>
  );
}
