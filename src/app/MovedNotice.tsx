import { useState } from "react";
import { toast } from "sonner";

import { Toaster } from "../components/ui/sonner";
import { HOME_HOST, HOME_PATH, homeUrl } from "../domain/address";
import { exportBackup } from "../features/board/backup";
import { useResolvedTheme } from "../store/themeStore";
import styles from "./MovedNotice.module.css";

/**
 * Shown instead of the app at an old address (see `domain/address.ts`).
 * Boards are saved per address, so whatever was saved here never reaches the
 * new one by itself: the notice links there, and offers the boards here as
 * an ordinary backup file, which "Restore from a backup file…" or "Import
 * boards…" takes in at the new address. Nothing here is changed or cleared.
 *
 * A link, not an automatic redirect: leaving on its own would strand
 * anything not yet exported.
 */
export function MovedNotice() {
  const theme = useResolvedTheme();
  const [busy, setBusy] = useState(false);
  const target = homeUrl(window.location.search, window.location.hash);
  const home = `${HOME_HOST}${HOME_PATH.replace(/\/$/, "")}`;

  const handleExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
    } catch {
      toast.error("The export failed. Nothing here was changed; try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <h1 className={styles.title}>This app moved to {home}</h1>
        <p className={styles.body}>Changes made here don’t sync and aren’t backed up.</p>
        <a className={styles.go} href={target}>
          Go to {home}
        </a>
        <button type="button" className={styles.export} disabled={busy} onClick={() => void handleExport()}>
          Export everything saved here
        </button>
        <p className={styles.hint}>
          The export is a backup file. At the new address, choose “Restore from a backup file…” (or “Import
          boards…” in the board menu) to bring these boards over. Boards already there are never replaced.
        </p>
      </div>
      <Toaster position="bottom-center" theme={theme} />
    </main>
  );
}
