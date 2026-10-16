import { describe, expect, it } from "vitest";

import {
  BACKUP_STALE_AFTER_MS,
  backupFileName,
  backupNeedsAttention,
  backupsNewestFirst,
  backupsToDelete,
  formatBackupAge,
  isBackupStale,
} from "./backupStatus";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 16, 12, 0).getTime();

/** `count` backup names, one a day, oldest first, ending on 2026-10-`lastDay`. */
function dailyBackups(count: number, lastDay = 30): string[] {
  return Array.from({ length: count }, (_, i) => backupFileName(new Date(2026, 9, lastDay - count + 1 + i, 9, 0)));
}

describe("backupFileName", () => {
  it("names a file by local date and time, zero-padded", () => {
    expect(backupFileName(new Date(2026, 0, 5, 7, 3))).toBe("boardkit-backup-2026-01-05-0703.json");
  });

  it("sorts oldest first as plain text", () => {
    const names = [new Date(2026, 9, 2, 9, 5), new Date(2026, 9, 10, 8, 0), new Date(2026, 9, 10, 13, 45)].map(
      backupFileName,
    );
    expect([...names].reverse().sort()).toEqual(names);
  });
});

describe("backupsNewestFirst", () => {
  it("keeps only automatic backups, newest first", () => {
    const names = [
      "boardkit-backup-2026-10-01-0900.json",
      "notes.txt",
      "boardkit-backup-2026-10-03-0900.json",
      "boardkit-backup-2026-10-02.json", // an "Export all boards…" download
      "linkkit-backup-2026-10-04-0900.json",
    ];
    expect(backupsNewestFirst(names)).toEqual([
      "boardkit-backup-2026-10-03-0900.json",
      "boardkit-backup-2026-10-01-0900.json",
    ]);
  });
});

describe("backupsToDelete", () => {
  it("keeps the newest 20, counting the file just written", () => {
    const names = dailyBackups(21);
    const justWritten = names.at(-1)!;
    expect(backupsToDelete(names, justWritten)).toEqual([names[0]]);
  });

  it("deletes nothing while there are 20 or fewer", () => {
    const names = dailyBackups(20);
    expect(backupsToDelete(names, names.at(-1)!)).toEqual([]);
    expect(backupsToDelete(names.slice(0, 3), names[2]!)).toEqual([]);
  });

  it("deletes several when the limit is lowered or files piled up", () => {
    const names = dailyBackups(25);
    expect(backupsToDelete(names, names.at(-1)!)).toEqual(names.slice(0, 5));
    expect(backupsToDelete(names, names.at(-1)!, 3)).toEqual(names.slice(0, 22));
  });

  it("never touches exports, Linkkit's backups or other files", () => {
    const ours = dailyBackups(22);
    const others = ["notes.txt", "boardkit-backup-2026-10-01.json", "linkkit-backup-2026-10-01-0900.json"];
    const doomed = backupsToDelete([...others, ...ours], ours.at(-1)!);
    expect(doomed).toEqual(ours.slice(0, 2));
  });

  it("never offers the file just written, even when a clock jump made it sort oldest", () => {
    const names = dailyBackups(20);
    const justWritten = "boardkit-backup-1999-01-01-0000.json";
    const doomed = backupsToDelete([justWritten, ...names], justWritten);
    expect(doomed).not.toContain(justWritten);
    expect(doomed).toEqual([names[0]]);
  });
});

describe("formatBackupAge", () => {
  it("reads like a person would say it", () => {
    expect(formatBackupAge(NOW - 30_000, NOW)).toBe("just now");
    expect(formatBackupAge(NOW - 2 * MINUTE, NOW)).toBe("2 min ago");
    expect(formatBackupAge(NOW - HOUR, NOW)).toBe("1 hour ago");
    expect(formatBackupAge(NOW - 3 * HOUR - 5 * MINUTE, NOW)).toBe("3 hours ago");
    expect(formatBackupAge(NOW - DAY, NOW)).toBe("1 day ago");
    expect(formatBackupAge(NOW - 9 * DAY, NOW)).toBe("9 days ago");
  });

  it("says just now for a time slightly in the future (a clock change)", () => {
    expect(formatBackupAge(NOW + 5 * MINUTE, NOW)).toBe("just now");
  });
});

describe("isBackupStale", () => {
  it("is stale when there was never a backup, or the last is over 7 days old", () => {
    expect(isBackupStale(null, NOW)).toBe(true);
    expect(isBackupStale(NOW - BACKUP_STALE_AFTER_MS - 1, NOW)).toBe(true);
    expect(isBackupStale(NOW - BACKUP_STALE_AFTER_MS, NOW)).toBe(false);
    expect(isBackupStale(NOW - DAY, NOW)).toBe(false);
  });
});

describe("backupNeedsAttention", () => {
  const old = NOW - 30 * DAY;
  const recent = NOW - HOUR;

  it("always when automatic backup has stopped and needs the user", () => {
    for (const status of ["needs-permission", "folder-error"] as const) {
      expect(backupNeedsAttention({ status, warning: null, lastBackupAt: recent, now: NOW })).toBe(true);
    }
  });

  it("always while a board is being held back, even with backups working", () => {
    const warning = "“Week 36” couldn't be read";
    expect(backupNeedsAttention({ status: "active", warning, lastBackupAt: recent, now: NOW })).toBe(true);
  });

  it("never while automatic backup is working, however old its last file", () => {
    expect(backupNeedsAttention({ status: "active", warning: null, lastBackupAt: old, now: NOW })).toBe(false);
    expect(backupNeedsAttention({ status: "active", warning: null, lastBackupAt: null, now: NOW })).toBe(false);
  });

  it("otherwise reminds after 7 days, or when there was never a backup", () => {
    for (const status of ["off", "unsupported"] as const) {
      expect(backupNeedsAttention({ status, warning: null, lastBackupAt: recent, now: NOW })).toBe(false);
      expect(backupNeedsAttention({ status, warning: null, lastBackupAt: old, now: NOW })).toBe(true);
      expect(backupNeedsAttention({ status, warning: null, lastBackupAt: null, now: NOW })).toBe(true);
    }
  });
});
