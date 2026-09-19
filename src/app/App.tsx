import { ThemeSwitch } from "../components/ThemeSwitch";
import { Toaster } from "../components/ui/sonner";
import { BoardCanvas } from "../features/board/BoardCanvas";
import { BoardSwitcher } from "../features/board/BoardSwitcher";
import { TrashPanel } from "../features/board/TrashPanel";
import { useResolvedTheme } from "../store/themeStore";
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
  // shadcn's toaster would otherwise read next-themes, which nothing here
  // provides, and follow the OS instead of the user's choice.
  const theme = useResolvedTheme();
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <BoardSwitcher />
        <ThemeSwitch />
        <TrashPanel />
      </header>
      <main className={styles.main}>
        <BoardCanvas />
      </main>
      <VersionBadge />
      <Toaster position="bottom-center" theme={theme} />
    </div>
  );
}
