import { toast } from "sonner";

import { backupFileName, backupsNewestFirst, backupsToDelete } from "../../domain/backupStatus";
import { imageIdOf } from "../../domain/background";
import {
  deserializeBackup,
  deserializeBackupImages,
  type BackupBoard,
  type BackupImage,
} from "../../domain/persistence";
import type { BoardSummary } from "../../domain/types";
import { useBackupStore } from "../../store/backupStore";
import { useBoardStore } from "../../store/boardStore";
import { idbDelete, idbGet, idbSet } from "../../store/idb";
import { buildBackup, collectBoards, listNames } from "./backup";

/**
 * Automatic backup to a folder the user picks (File System Access API, so
 * Chrome and Edge only). A few seconds after edits stop, every board is
 * written to a new file in that folder -- same format as "Export all
 * boards…", so "Import boards…" restores it -- and the oldest files beyond
 * the last 20 are deleted.
 *
 * The folder handle is kept in IndexedDB. After a browser restart Chrome
 * wants one click before it allows writing again, so startup can land in
 * "needs-permission" and the menu offers "Resume backups". Backups never stop
 * silently: every stop is a status the UI shows.
 */

/** The parts of the File System Access API this module uses. `lib.dom` does
    not declare the permission methods or the async iteration, and this is
    the only place they are needed. */
export type Folder = FileSystemDirectoryHandle & {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemHandle>;
};

type PickerWindow = Window & {
  showDirectoryPicker?: (options: { id: string; mode: "read" | "readwrite" }) => Promise<Folder>;
};

const FOLDER_KEY = "backupFolder";
const QUIET_PERIOD_MS = 10_000;

let folder: Folder | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let rerun = false;
/** The boards as last written, so a switch or rename-back that changes
    nothing does not spend one of the 20 slots on an identical file. */
let lastWritten: string | null = null;

export function isAutoBackupSupported(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === "function";
}

const backup = () => useBackupStore.getState();

/** Sets things up once at startup: restores the saved folder and starts
    watching for changes. Returns a function that stops both. */
export function initAutoBackup(): () => void {
  if (!isAutoBackupSupported()) {
    backup().setAuto("unsupported", null);
    return () => {};
  }
  void restoreFolder();
  const unsubscribe = useBoardStore.subscribe((state, previous) => {
    // The same slices the persistence subscriber watches, plus the board
    // list and active board: create, delete, rename, import and switch.
    if (
      state.lists !== previous.lists ||
      state.cards !== previous.cards ||
      state.listOrder !== previous.listOrder ||
      state.cardOrder !== previous.cardOrder ||
      state.trash !== previous.trash ||
      state.trashedLists !== previous.trashedLists ||
      state.background !== previous.background ||
      state.boards !== previous.boards ||
      state.boardId !== previous.boardId
    ) {
      scheduleBackup();
    }
  });
  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}

async function restoreFolder(): Promise<void> {
  try {
    const saved = await idbGet<Folder>(FOLDER_KEY);
    if (!saved) {
      backup().setAuto("off", null);
      return;
    }
    folder = saved;
    const permission = await saved.queryPermission({ mode: "readwrite" });
    backup().setAuto(permission === "granted" ? "active" : "needs-permission", saved.name);
  } catch {
    backup().setAuto("off", null);
  }
}

/** Waits for a quiet moment so a drag or a burst of typing writes one file,
    not dozens. Deliberately no write on page close: the API is asynchronous
    and cannot be relied on to finish there. */
function scheduleBackup(): void {
  if (backup().status !== "active") return;
  clearTimeout(timer);
  timer = setTimeout(() => void runBackup(), QUIET_PERIOD_MS);
}

/** Only ever one write in flight; a change during a write earns one more. */
async function runBackup(): Promise<void> {
  if (!folder || backup().status !== "active") return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    await writeBackupFile(folder);
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      scheduleBackup();
    }
  }
}

const NO_COPIES = { boards: [], images: {} } as const;

/**
 * The newest backed-up version of each board in `wanted`, from the backup
 * files in `target`, with the pictures they use. A board in no file is
 * simply missing from the result. Renames since then are kept: the copy
 * takes the board's current name.
 */
async function lastBackedUpCopies(
  target: Folder,
  wanted: readonly BoardSummary[],
): Promise<{ readonly boards: BackupBoard[]; readonly images: Record<string, BackupImage> }> {
  const boards: BackupBoard[] = [];
  const images: Record<string, BackupImage> = {};
  for await (const { data } of readBackupsNewestFirst(target)) {
    const entries = deserializeBackup(data) ?? [];
    const fileImages = deserializeBackupImages(data);
    for (const { id, name } of wanted) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry || boards.some((found) => found.id === id)) continue;
      boards.push({ ...entry, name });
      const imageId = imageIdOf(entry.board.background);
      if (imageId !== undefined && fileImages[imageId]) images[imageId] = fileImages[imageId];
    }
    if (boards.length === wanted.length) break;
  }
  return { boards, images };
}

/** What the backup menu says while boards are held back, or `null`. */
function heldBackWarning(unreadable: readonly BoardSummary[], carried: readonly BackupBoard[]): string | null {
  if (unreadable.length === 0) return null;
  const kept = unreadable.filter((board) => carried.some((copy) => copy.id === board.id)).map((board) => board.name);
  const left = unreadable.filter((board) => !carried.some((copy) => copy.id === board.id)).map((board) => board.name);
  const parts: string[] = [];
  if (kept.length > 0) {
    parts.push(`${listNames(kept)} couldn't be read, so new backups keep ${kept.length === 1 ? "its" : "their"} last backed-up version.`);
  }
  if (left.length > 0) {
    parts.push(`${listNames(left)} couldn't be read and ${left.length === 1 ? "isn't" : "aren't"} in any backup yet, so ${left.length === 1 ? "it's" : "they're"} left out.`);
  }
  parts.push("Other boards are backed up as usual.");
  return parts.join(" ");
}

/** The parsed backup files this app wrote in `target`, newest first. A file
    that fails to read is skipped; a folder that can't be listed yields
    nothing. Lazy, so a search can stop at the first file it needs. */
export async function* readBackupsNewestFirst(
  target: Folder,
): AsyncGenerator<{ readonly name: string; readonly data: unknown }> {
  const names: string[] = [];
  try {
    for await (const entry of target.values()) {
      if (entry.kind === "file") names.push(entry.name);
    }
  } catch {
    return;
  }
  for (const name of backupsNewestFirst(names)) {
    try {
      const file = await (await target.getFileHandle(name)).getFile();
      yield { name, data: JSON.parse(await file.text()) as unknown };
    } catch {
      // One unreadable file must not end the search.
    }
  }
}

async function writeBackupFile(target: Folder): Promise<void> {
  const { boards: readable, unreadable } = collectBoards();
  // A board that can't be read is held back, not dropped: each new file
  // carries its last backed-up version forward, so rotation never pushes
  // its last good copy out of the folder, and every other board is still
  // backed up as usual. The warning clears once everything reads again.
  const held = unreadable.length > 0 ? await lastBackedUpCopies(target, unreadable) : NO_COPIES;
  backup().setWarning(heldBackWarning(unreadable, held.boards));

  const order = useBoardStore.getState().boards.map((board) => board.id);
  const boards = [...readable, ...held.boards].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const now = new Date();
  const signature = JSON.stringify(boards);
  if (signature === lastWritten) return;

  const name = backupFileName(now);
  // Built before the try: a failure reading a picture is not a folder problem
  // and must not be reported as one below.
  const text = JSON.stringify(await buildBackup(boards, now, held.images), null, 2);
  try {
    // `createWritable` writes to a temporary file and only replaces the real
    // one on `close()`, so a crash mid-write cannot leave half a backup.
    const file = await target.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
  } catch (error) {
    // The folder was deleted or moved, or the permission was withdrawn.
    const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
    backup().setAuto(denied ? "needs-permission" : "folder-error", target.name);
    return;
  }
  lastWritten = signature;
  backup().markBackedUp(now.getTime());
  await rotate(target, name);
}

/** Deletes old backups beyond the newest 20 -- only ever after a new one was
    written, so repeated failures cannot eat the good copies. A failure here
    is ignored: the backup itself succeeded, and the next round tries again. */
async function rotate(target: Folder, justWritten: string): Promise<void> {
  try {
    const names: string[] = [];
    for await (const entry of target.values()) {
      if (entry.kind === "file") names.push(entry.name);
    }
    for (const old of backupsToDelete(names, justWritten)) {
      await target.removeEntry(old);
    }
  } catch {
    // See above.
  }
}

/**
 * The newest backup in the folder that has `boardId` in it, parsed, for
 * restoring a damaged board. Newest first, and only files this app wrote;
 * one that fails to read is skipped rather than ending the search. `null`
 * when there is no folder, access is refused, or no backup has the board.
 * Must run from a click: the browser may ask to allow the folder again.
 */
export async function findLatestBackupWith(
  boardId: string,
): Promise<{ readonly name: string; readonly data: unknown } | null> {
  if (!folder) return null;
  try {
    if ((await folder.requestPermission({ mode: "readwrite" })) !== "granted") return null;
    for await (const backup of readBackupsNewestFirst(folder)) {
      if (deserializeBackup(backup.data)?.some((entry) => entry.id === boardId)) return backup;
    }
  } catch {
    // Folder gone or permission withdrawn: same as finding nothing.
  }
  return null;
}

/** "Automatic backup…" / "Choose folder…". Must run from a click, because
    the folder picker requires one. */
export async function chooseBackupFolder(): Promise<void> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return;
  let chosen: Folder;
  try {
    chosen = await picker.call(window, { id: "boardkit-backup", mode: "readwrite" });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      toast.error("Couldn't open that folder.");
    }
    return;
  }
  folder = chosen;
  lastWritten = null;
  try {
    await idbSet(FOLDER_KEY, chosen);
  } catch {
    toast.warning("This browser won't remember the folder, so it will need choosing again after a restart.");
  }
  backup().setAuto("active", chosen.name);
  await runBackup();
  if (backup().status === "active") toast.success(`Backing up to ${chosen.name}`);
}

/** A folder picked only to read backups from (restoring everything at a new
    address), without making it the backup folder. `null` when cancelled or
    unsupported. Must run from a click. */
export async function pickFolderToRead(): Promise<Folder | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker.call(window, { id: "boardkit-backup", mode: "read" });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      toast.error("Couldn't open that folder.");
    }
    return null;
  }
}

/** "Resume backups": asks the browser to allow the saved folder again. Must
    run from a click. */
export async function resumeBackups(): Promise<void> {
  if (!folder) return;
  try {
    const permission = await folder.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") return;
  } catch {
    backup().setAuto("folder-error", folder.name);
    return;
  }
  backup().setAuto("active", folder.name);
  // Anything edited while backups were paused was never written.
  lastWritten = null;
  await runBackup();
}

export async function turnOffAutoBackup(): Promise<void> {
  clearTimeout(timer);
  folder = undefined;
  lastWritten = null;
  backup().setAuto("off", null);
  backup().setWarning(null);
  try {
    await idbDelete(FOLDER_KEY);
  } catch {
    // Already off in memory; a stale handle in IndexedDB is harmless, and the
    // next "Automatic backup…" replaces it.
  }
}
