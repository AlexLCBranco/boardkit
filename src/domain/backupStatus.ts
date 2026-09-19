/**
 * The pure rules behind the backup reminder and automatic backup: when a
 * backup counts as stale, how its age reads, what the files are called and
 * which old ones to delete. No storage, no clock of its own -- callers pass
 * `now` in, so every rule here can be tested with fixed numbers.
 */

/** The state of the folder-backed automatic backup, from the user's side. */
export type AutoBackupStatus =
  /** This browser cannot write to a folder (Firefox, Safari). */
  | "unsupported"
  | "off"
  | "active"
  /** A folder is chosen but the browser wants one click to allow access. */
  | "needs-permission"
  /** The folder is gone, or writing to it keeps failing. */
  | "folder-error";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** After this long without a backup, the switcher shows its attention dot. */
export const BACKUP_STALE_AFTER_MS = 7 * DAY_MS;

/** Automatic backup keeps this many files in the folder. */
export const BACKUPS_TO_KEEP = 20;

/** True if there has never been a backup, or the last one is over 7 days old. */
export function isBackupStale(lastBackupAt: number | null, now: number): boolean {
  return lastBackupAt === null || now - lastBackupAt > BACKUP_STALE_AFTER_MS;
}

/** "just now", "2 min ago", "3 hours ago", "9 days ago". */
export function formatBackupAge(lastBackupAt: number, now: number): string {
  const elapsed = Math.max(0, now - lastBackupAt);
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), "hour");
  return plural(Math.floor(elapsed / DAY_MS), "day");
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * Whether the switcher should show its dot. Automatic backup that is working
 * never needs attention, however old the last file is; anything that has
 * stopped it (a permission click, a missing folder, an unreadable board)
 * always does; otherwise it is the plain 7-day reminder.
 */
export function backupNeedsAttention(input: {
  readonly status: AutoBackupStatus;
  readonly warning: string | null;
  readonly lastBackupAt: number | null;
  readonly now: number;
}): boolean {
  const { status, warning, lastBackupAt, now } = input;
  if (status === "needs-permission" || status === "folder-error" || warning !== null) return true;
  if (status === "active") return false;
  return isBackupStale(lastBackupAt, now);
}

const FILE_NAME = /^boardkit-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/;

/** `boardkit-backup-2026-09-19-1432.json`: local time, and sorts oldest-first
    as plain text. */
export function backupFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  return `boardkit-backup-${day}-${two(date.getHours())}${two(date.getMinutes())}.json`;
}

/**
 * Which files rotation should delete: the oldest backups beyond `keep`.
 * Only names this app would have written are considered, so anything else
 * the user keeps in the folder is never touched, and `justWritten` is never
 * offered even if a clock jump made it sort oldest.
 */
export function backupsToDelete(
  names: readonly string[],
  justWritten: string,
  keep: number = BACKUPS_TO_KEEP,
): string[] {
  const ours = names.filter((name) => FILE_NAME.test(name) && name !== justWritten).sort();
  return ours.slice(0, Math.max(0, ours.length - (keep - 1)));
}
