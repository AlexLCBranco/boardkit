import { DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { backupNeedsAttention, formatBackupAge } from "../../domain/backupStatus";
import { useNow } from "../../hooks/useNow";
import { useLastBackupAt } from "../../store/selectors";
import { exportBackup } from "./backup";
import styles from "./BackupReminder.module.css";

/** How often "9 days ago" is recomputed while the page stays open. */
const TICK_MS = 60_000;

/** Whether the switcher should show its attention dot. */
export function useBackupAttention(): boolean {
  const lastBackupAt = useLastBackupAt();
  const now = useNow(TICK_MS);
  return backupNeedsAttention({ status: "off", warning: null, lastBackupAt, now });
}

/**
 * One quiet line in the board menu: when the last backup was, and a button to
 * make one. The whole row is the button, so it is as easy to hit as any other
 * menu item.
 */
export function BackupReminder() {
  const lastBackupAt = useLastBackupAt();
  const now = useNow(TICK_MS);
  const age = lastBackupAt === null ? "never" : formatBackupAge(lastBackupAt, now);
  return (
    <DropdownMenuItem onSelect={exportBackup}>
      <span className={styles.status}>Last backup: {age}</span>
      <span className={styles.action}>Back up now</span>
    </DropdownMenuItem>
  );
}
