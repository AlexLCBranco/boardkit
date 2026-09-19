import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "../../components/ui/dropdown-menu";
import { backupNeedsAttention, formatBackupAge } from "../../domain/backupStatus";
import { useNow } from "../../hooks/useNow";
import {
  useAutoBackupStatus,
  useBackupFolderName,
  useBackupWarning,
  useLastBackupAt,
} from "../../store/selectors";
import { exportBackup } from "./backup";
import { chooseBackupFolder, isAutoBackupSupported, resumeBackups, turnOffAutoBackup } from "./autoBackup";
import styles from "./BackupMenuItems.module.css";

/** How often "9 days ago" is recomputed while the page stays open. */
const TICK_MS = 60_000;

/** Whether the switcher should show its attention dot. */
export function useBackupAttention(): boolean {
  const status = useAutoBackupStatus();
  const warning = useBackupWarning();
  const lastBackupAt = useLastBackupAt();
  const now = useNow(TICK_MS);
  return backupNeedsAttention({ status, warning, lastBackupAt, now });
}

/**
 * One quiet line in the board menu saying how backups stand, with the action
 * that fits: a reminder with "Back up now" when automatic backup is off, a
 * plain status when it is working, "Resume backups" or "Choose folder…" when
 * it has stopped. Plus a warning line when an unreadable board is holding
 * automatic backups back. The whole row is the button, so it is as easy to
 * hit as any other menu item.
 */
export function BackupStatusLine() {
  const status = useAutoBackupStatus();
  const folderName = useBackupFolderName();
  const warning = useBackupWarning();
  const lastBackupAt = useLastBackupAt();
  const now = useNow(TICK_MS);
  const age = lastBackupAt === null ? null : formatBackupAge(lastBackupAt, now);

  return (
    <>
      {status === "active" ? (
        <DropdownMenuLabel className={styles.status}>
          Backing up to {folderName} · last saved {age ?? "not yet"}
        </DropdownMenuLabel>
      ) : status === "needs-permission" ? (
        <DropdownMenuItem onSelect={() => void resumeBackups()}>
          <span className={styles.status}>Backups paused</span>
          <span className={styles.action}>Resume backups</span>
        </DropdownMenuItem>
      ) : status === "folder-error" ? (
        <DropdownMenuItem onSelect={() => void chooseBackupFolder()}>
          <span className={styles.status}>Can’t write to the backup folder</span>
          <span className={styles.action}>Choose folder…</span>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={exportBackup}>
          <span className={styles.status}>Last backup: {age ?? "never"}</span>
          <span className={styles.action}>Back up now</span>
        </DropdownMenuItem>
      )}
      {warning && <DropdownMenuLabel className={styles.warning}>{warning}</DropdownMenuLabel>}
    </>
  );
}

/** "Automatic backup…" and "Turn off automatic backup". Renders nothing where
    the browser cannot write to a folder (Firefox, Safari). */
export function AutomaticBackupItems() {
  const status = useAutoBackupStatus();
  if (!isAutoBackupSupported()) return null;
  return (
    <>
      <DropdownMenuItem onSelect={() => void chooseBackupFolder()}>Automatic backup…</DropdownMenuItem>
      {status !== "off" && status !== "unsupported" && (
        <DropdownMenuItem onSelect={() => void turnOffAutoBackup()}>Turn off automatic backup</DropdownMenuItem>
      )}
    </>
  );
}
