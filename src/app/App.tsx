import { BoardCanvas } from "../features/board/BoardCanvas";
import styles from "./App.module.css";

/**
 * App owns the page chrome only: a header and the scroll container the board
 * lives in. It deliberately knows nothing about lists or cards, so the board
 * can later be embedded elsewhere (a modal, a split view) without changes.
 */
export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Untitled board</h1>
      </header>
      <main className={styles.main}>
        <BoardCanvas />
      </main>
    </div>
  );
}
