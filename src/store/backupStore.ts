import { create } from "zustand";

import type { AutoBackupStatus } from "../domain/backupStatus";

/**
 * What the UI needs to know about backups: when the last one happened and
 * how automatic backup is doing. Kept apart from `boardStore` because none
 * of it belongs to a board -- it is per browser, and it must never be part
 * of a board's undo history or its saved content.
 *
 * `lastBackupAt` is the only piece that survives a reload (its own
 * `localStorage` key, below). The folder handle lives in IndexedDB; status is
 * rebuilt from it at startup by `features/board/autoBackup.ts`.
 */
const STORAGE_KEY = "boardkit:lastBackupAt";

function loadLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

interface BackupState {
  readonly lastBackupAt: number | null;
  readonly status: AutoBackupStatus;
  /** Name of the chosen folder, for display. */
  readonly folderName: string | null;
  /** Why backups are held back right now (an unreadable board), if they are. */
  readonly warning: string | null;
  readonly markBackedUp: (at: number) => void;
  readonly setAuto: (status: AutoBackupStatus, folderName: string | null) => void;
  readonly setWarning: (warning: string | null) => void;
}

export const useBackupStore = create<BackupState>((set) => ({
  lastBackupAt: loadLastBackupAt(),
  status: "off",
  folderName: null,
  warning: null,

  markBackedUp: (at) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(at));
    } catch {
      // Quota or private browsing: the reminder just falls back to memory.
    }
    set({ lastBackupAt: at });
  },
  setAuto: (status, folderName) => set({ status, folderName }),
  setWarning: (warning) => set({ warning }),
}));
