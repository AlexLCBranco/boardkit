import { toast } from "sonner";

import { backupFileName, backupsToDelete } from "../../domain/backupStatus";
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
type Folder = FileSystemDirectoryHandle & {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemHandle>;
};

type PickerWindow = Window & {
  showDirectoryPicker?: (options: { id: string; mode: "readwrite" }) => Promise<Folder>;
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

async function writeBackupFile(target: Folder): Promise<void> {
  const { boards, unreadable } = collectBoards();
  if (unreadable.length > 0) {
    // Not writing at all is the point: rotation would otherwise trade good
    // old copies for backups with these boards missing. The next change
    // retries, and the warning clears as soon as everything reads again.
    backup().setWarning(
      `${listNames(unreadable)} couldn't be read; backups paused so older copies stay safe.`,
    );
    return;
  }
  backup().setWarning(null);

  const now = new Date();
  const signature = JSON.stringify(boards);
  if (signature === lastWritten) return;

  const name = backupFileName(now);
  // Built before the try: a failure reading a picture is not a folder problem
  // and must not be reported as one below.
  const text = JSON.stringify(await buildBackup(boards, now), null, 2);
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
