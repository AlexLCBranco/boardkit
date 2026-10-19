import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backupFileName, backupsNewestFirst } from "../../domain/backupStatus";
import { deserializeBackup, serializeBackup, type BackupBoard } from "../../domain/persistence";
import { createBoard } from "../../domain/seed";
import type { BoardId, BoardSummary } from "../../domain/types";
import type { Folder } from "./autoBackup";

/**
 * The real automatic backup (`autoBackup.ts`) against an in-memory folder.
 * Tests run in Node, which has no folder picker, IndexedDB or board store, so
 * those are swapped for small stand-ins: the board store keeps only what the
 * backup watches, `collectBoards` returns whatever a test puts in `env`, and
 * IndexedDB is a Map. Everything else -- the quiet period, the skip when
 * nothing changed, rotation, failures, held-back boards -- is the app's own
 * code.
 */

const env = vi.hoisted(() => ({
  collected: { boards: [] as BackupBoard[], unreadable: [] as BoardSummary[] },
  idb: new Map<string, unknown>(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock("../../store/idb", () => ({
  idbGet: async (key: string) => env.idb.get(key),
  idbSet: async (key: string, value: unknown) => void env.idb.set(key, value),
  idbDelete: async (key: string) => void env.idb.delete(key),
}));

vi.mock("../../store/boardStore", async () => {
  const { create } = await import("zustand");
  return {
    useBoardStore: create(() => ({
      boards: [] as BoardSummary[],
      boardId: null as BoardId | null,
      lists: {},
      cards: {},
      listOrder: [],
      cardOrder: {},
      trash: [],
      trashedLists: [],
      background: undefined,
    })),
  };
});

vi.mock("./backup", async () => {
  const { serializeBackup: serialize } = await import("../../domain/persistence");
  return {
    collectBoards: () => env.collected,
    buildBackup: async (boards: readonly BackupBoard[], now: Date, images = {}) =>
      serialize(boards, now.toISOString(), images),
    listNames: (names: readonly string[]) => names.map((name) => `“${name}”`).join(" and "),
  };
});

/** A folder the File System Access API would hand over, kept in memory. */
class FakeFolder {
  readonly kind = "directory";
  readonly files = new Map<string, string>();
  permission: PermissionState = "granted";
  /** Set to make every write fail, as a deleted folder or withdrawn permission does. */
  failWrites: DOMException | null = null;
  /** Every file write started, including ones that replace a file. */
  writes = 0;

  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async queryPermission() {
    return this.permission;
  }

  async requestPermission() {
    return this.permission;
  }

  async *values() {
    for (const name of [...this.files.keys()]) yield { kind: "file" as const, name };
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new DOMException(name, "NotFoundError");
    return {
      getFile: async () => ({ text: async () => this.files.get(name) ?? "" }),
      createWritable: async () => {
        this.writes++;
        if (this.failWrites) throw this.failWrites;
        let text = "";
        return {
          write: async (chunk: string) => void (text += chunk),
          // Like the real API: the file only appears once the write is closed.
          close: async () => void this.files.set(name, text),
        };
      },
    };
  }

  async removeEntry(name: string) {
    this.files.delete(name);
  }

  backups(): string[] {
    return backupsNewestFirst([...this.files.keys()]);
  }

  /** The boards in a backup file, by name and first card title. */
  read(name: string): { id: string; name: string; firstCard: string | undefined }[] {
    const entries = deserializeBackup(JSON.parse(this.files.get(name)!)) ?? [];
    return entries.map(({ id, name: boardName, board }) => ({
      id,
      name: boardName,
      firstCard: Object.values(board.cards)[0]?.title,
    }));
  }

  asFolder(): Folder {
    return this as unknown as Folder;
  }
}

const A = "boardA" as BoardId;
const B = "boardB" as BoardId;
const C = "boardC" as BoardId;

function board(id: BoardId, name: string, card: string): BackupBoard {
  return { id, name, board: createBoard([{ title: "To do", cards: [card] }]) };
}

/** Runs every pending promise; timers stay frozen. `setImmediate` is Node's
    (left real by the fake timers); the app's types don't declare it. */
/** Boardkit's home address (local development counts as home). */
const HOME = { hostname: "localhost" };
const { setImmediate } = globalThis as unknown as { setImmediate: (run: () => void) => void };
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

let auto: typeof import("./autoBackup");
let backupStore: typeof import("../../store/backupStore").useBackupStore;
let boardStore: typeof import("../../store/boardStore").useBoardStore;
let stopWatching: () => void;
let picked: FakeFolder;

/** An edit: a new `lists` object, as every store action makes, and what
    `collectBoards` would then read. */
function edit(...boards: BackupBoard[]) {
  env.collected = { boards, unreadable: [] };
  boardStore.setState({ lists: {} });
}

/** Starts the app (restoring a saved folder, if any) and picks `picked`. */
async function startAndChoose() {
  stopWatching = auto.initAutoBackup();
  await settle();
  await auto.chooseBackupFolder();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 9, 30));
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  });
  picked = new FakeFolder("Backups");
  vi.stubGlobal("window", { location: HOME, showDirectoryPicker: async () => picked.asFolder() });
  env.idb.clear();

  // A fresh copy of the module each time: it keeps the folder and the last
  // file written in module variables, as it does for the page's lifetime.
  vi.resetModules();
  auto = await import("./autoBackup");
  backupStore = (await import("../../store/backupStore")).useBackupStore;
  boardStore = (await import("../../store/boardStore")).useBoardStore;
  boardStore.setState({ boards: [{ id: A, name: "Week 36" }, { id: B, name: "Sprint" }], boardId: A });
  env.collected = { boards: [board(A, "Week 36", "Rent"), board(B, "Sprint", "Plan")], unreadable: [] };
  stopWatching = () => {};
});

afterEach(() => {
  stopWatching();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("choosing a folder", () => {
  it("writes every board to a new file at once and marks the backup done", async () => {
    await startAndChoose();

    expect(backupStore.getState().status).toBe("active");
    expect(backupStore.getState().folderName).toBe("Backups");
    expect(picked.backups()).toEqual(["boardkit-backup-2026-10-16-0930.json"]);
    expect(picked.read("boardkit-backup-2026-10-16-0930.json")).toEqual([
      { id: A, name: "Week 36", firstCard: "Rent" },
      { id: B, name: "Sprint", firstCard: "Plan" },
    ]);
    expect(backupStore.getState().lastBackupAt).toBe(Date.now());
    expect(localStorage.getItem("boardkit:lastBackupAt")).toBe(String(Date.now()));
    expect(env.idb.get("backupFolder")).toBe(picked);
  });

  it("is unsupported, and stays quiet, where the browser has no folder picker", async () => {
    vi.stubGlobal("window", { location: HOME });
    stopWatching = auto.initAutoBackup();
    await auto.chooseBackupFolder();
    expect(backupStore.getState().status).toBe("unsupported");
    expect(picked.files.size).toBe(0);
  });

  it("is unsupported on a preview of the gauntlet site, so its test boards never reach the real backup folder", async () => {
    vi.stubGlobal("window", {
      location: { hostname: "gauntlet-home-git-phase-2-alexlcbrancos-projects.vercel.app" },
      showDirectoryPicker: async () => picked.asFolder(),
    });
    expect(auto.isAutoBackupSupported()).toBe(false);
    stopWatching = auto.initAutoBackup();
    await auto.chooseBackupFolder();
    expect(backupStore.getState().status).toBe("unsupported");
    expect(picked.files.size).toBe(0);
  });
});

describe("after edits", () => {
  it("waits for 10 quiet seconds, so a burst of edits writes one file", async () => {
    await startAndChoose();
    vi.setSystemTime(new Date(2026, 9, 16, 9, 41));

    edit(board(A, "Week 36", "Rent paid"), board(B, "Sprint", "Plan"));
    await vi.advanceTimersByTimeAsync(6_000);
    edit(board(A, "Week 36", "Rent paid!"), board(B, "Sprint", "Plan"));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(picked.backups()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(picked.backups()).toHaveLength(2);
    expect(picked.read(picked.backups()[0]!)[0]!.firstCard).toBe("Rent paid!");
  });

  it("writes no new file when nothing changed since the last one", async () => {
    await startAndChoose();
    vi.setSystemTime(new Date(2026, 9, 16, 9, 41));

    // A switch away and back: the store changes, the boards don't.
    boardStore.setState({ boardId: B });
    boardStore.setState({ boardId: A });
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(picked.backups()).toHaveLength(1);
  });

  it("writes nothing while backups are off, and stops after being turned off", async () => {
    stopWatching = auto.initAutoBackup();
    await settle();
    edit(board(A, "Week 36", "Rent paid"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(backupStore.getState().status).toBe("off");

    await auto.chooseBackupFolder();
    await auto.turnOffAutoBackup();
    edit(board(A, "Week 36", "Rent paid again"));
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(picked.backups()).toHaveLength(1);
    expect(backupStore.getState().status).toBe("off");
    expect(env.idb.has("backupFolder")).toBe(false);
  });
});

describe("several copies of Boardkit open (tabs, canvas frames)", () => {
  /** What the browser sends every other copy when one saves a board. */
  function storageEvent(key: string): Event {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    return event;
  }

  it("only one writes a backup for a change; another takes over when it closes", async () => {
    const page = Object.assign(new EventTarget(), { location: HOME, showDirectoryPicker: async () => picked.asFolder() });
    vi.stubGlobal("window", page);
    await startAndChoose();
    expect(picked.writes).toBe(1);

    // A second copy: its own modules, the same browser (lock, folder, storage).
    vi.resetModules();
    const other = await import("./autoBackup");
    const otherBoards = (await import("../../store/boardStore")).useBoardStore;
    const stopOther = other.initAutoBackup();
    try {
      await settle();
      expect((await import("../../store/backupStore")).useBackupStore.getState().status).toBe("active");

      // An edit in the second copy: both hear of it (its own store, and the
      // storage event in the first), but only the writer writes.
      vi.setSystemTime(new Date(2026, 9, 16, 9, 41));
      env.collected = { boards: [board(A, "Week 36", "Rent paid")], unreadable: [] };
      otherBoards.setState({ lists: {} });
      page.dispatchEvent(storageEvent("boardkit:board:boardA"));
      await vi.advanceTimersByTimeAsync(10_000);
      await settle();
      expect(picked.writes).toBe(2);
      expect(picked.read(picked.backups()[0]!)[0]!.firstCard).toBe("Rent paid");

      // The writer closes: the second copy takes over, and backs up what
      // changed since.
      vi.setSystemTime(new Date(2026, 9, 16, 9, 52));
      env.collected = { boards: [board(A, "Week 36", "Rent paid twice")], unreadable: [] };
      stopWatching();
      stopWatching = () => {};
      await settle();
      await vi.advanceTimersByTimeAsync(10_000);
      await settle();
      expect(picked.writes).toBe(3);
      expect(picked.read(picked.backups()[0]!)[0]!.firstCard).toBe("Rent paid twice");
    } finally {
      stopOther();
    }
  });

  it("backs up a change made in another copy, though this one's store didn't change", async () => {
    const page = Object.assign(new EventTarget(), { location: HOME, showDirectoryPicker: async () => picked.asFolder() });
    vi.stubGlobal("window", page);
    await startAndChoose();
    vi.setSystemTime(new Date(2026, 9, 16, 9, 41));
    env.collected = { boards: [board(A, "Week 36", "Edited in a frame")], unreadable: [] };
    page.dispatchEvent(storageEvent("boardkit:board:boardA"));
    page.dispatchEvent(storageEvent("boardkit:theme"));
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(picked.backups()).toHaveLength(2);
    expect(picked.read(picked.backups()[0]!)[0]!.firstCard).toBe("Edited in a frame");
  });
});

describe("rotation", () => {
  it("keeps the newest 20 backups and never touches other files", async () => {
    const old = Array.from({ length: 20 }, (_, i) => backupFileName(new Date(2026, 8, i + 1, 9, 0)));
    for (const name of old) picked.files.set(name, "{}");
    picked.files.set("notes.txt", "mine");
    picked.files.set("boardkit-backup-2026-09-01.json", "an export");

    await startAndChoose();

    const kept = picked.backups();
    expect(kept).toHaveLength(20);
    expect(kept[0]).toBe("boardkit-backup-2026-10-16-0930.json");
    expect(kept).not.toContain(old[0]);
    expect(picked.files.get("notes.txt")).toBe("mine");
    expect(picked.files.has("boardkit-backup-2026-09-01.json")).toBe(true);
  });
});

describe("when writing fails", () => {
  const twentyOld = () => {
    for (let day = 1; day <= 20; day++) picked.files.set(backupFileName(new Date(2026, 8, day, 9, 0)), "{}");
  };

  it("a withdrawn permission pauses backups and deletes no old file", async () => {
    twentyOld();
    picked.failWrites = new DOMException("no", "NotAllowedError");
    await startAndChoose();

    expect(backupStore.getState().status).toBe("needs-permission");
    expect(picked.backups()).toHaveLength(20);
    expect(backupStore.getState().lastBackupAt).toBeNull();
  });

  it("a folder that is gone is a folder error, and deletes no old file", async () => {
    twentyOld();
    picked.failWrites = new DOMException("gone", "NotFoundError");
    await startAndChoose();

    expect(backupStore.getState().status).toBe("folder-error");
    expect(picked.backups()).toHaveLength(20);
  });

  it("“Resume backups” writes what was edited while paused", async () => {
    picked.failWrites = new DOMException("no", "NotAllowedError");
    await startAndChoose();
    edit(board(A, "Week 36", "Edited while paused"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(picked.backups()).toHaveLength(0);

    picked.failWrites = null;
    await auto.resumeBackups();

    expect(backupStore.getState().status).toBe("active");
    expect(picked.read(picked.backups()[0]!)[0]!.firstCard).toBe("Edited while paused");
  });

  it("“Resume backups” stays paused when the user doesn't allow it", async () => {
    picked.failWrites = new DOMException("no", "NotAllowedError");
    await startAndChoose();
    picked.failWrites = null;
    picked.permission = "denied";

    await auto.resumeBackups();
    expect(backupStore.getState().status).toBe("needs-permission");
    expect(picked.backups()).toHaveLength(0);
  });
});

describe("after a browser restart", () => {
  it("a saved folder that needs a click starts paused, and writes nothing until allowed", async () => {
    picked.permission = "prompt";
    env.idb.set("backupFolder", picked);
    stopWatching = auto.initAutoBackup();
    await settle();
    expect(backupStore.getState().status).toBe("needs-permission");
    expect(backupStore.getState().folderName).toBe("Backups");

    edit(board(A, "Week 36", "Rent paid"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(picked.files.size).toBe(0);

    picked.permission = "granted";
    await auto.resumeBackups();
    expect(backupStore.getState().status).toBe("active");
    expect(picked.backups()).toHaveLength(1);
  });

  it("a saved folder still allowed carries straight on", async () => {
    env.idb.set("backupFolder", picked);
    stopWatching = auto.initAutoBackup();
    await settle();
    expect(backupStore.getState().status).toBe("active");

    edit(board(A, "Week 36", "Rent paid"));
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(picked.backups()).toHaveLength(1);
  });
});

describe("a board that can't be read", () => {
  it("is carried forward from the newest backup that has it, under its current name", async () => {
    // Two earlier backups; the newer one holds Sprint's latest good copy.
    const write = (at: Date, boards: BackupBoard[]) =>
      picked.files.set(backupFileName(at), JSON.stringify(serializeBackup(boards, at.toISOString())));
    write(new Date(2026, 9, 14, 9, 0), [board(A, "Week 36", "Old rent"), board(B, "Sprint", "Oldest plan")]);
    write(new Date(2026, 9, 15, 9, 0), [board(A, "Week 36", "Rent"), board(B, "Sprint", "Latest plan")]);
    picked.files.set(backupFileName(new Date(2026, 9, 15, 10, 0)), "{ not json"); // skipped, not fatal
    boardStore.setState({ boards: [{ id: B, name: "Sprint 2" }, { id: A, name: "Week 36" }] });
    env.collected = { boards: [board(A, "Week 36", "Rent paid")], unreadable: [{ id: B, name: "Sprint 2" }] };

    await startAndChoose();

    expect(picked.read(picked.backups()[0]!)).toEqual([
      { id: B, name: "Sprint 2", firstCard: "Latest plan" },
      { id: A, name: "Week 36", firstCard: "Rent paid" },
    ]);
    expect(backupStore.getState().warning).toMatch(/“Sprint 2” couldn't be read, so new backups keep its last/);
  });

  it("is left out, and named, when no backup has it yet; the warning clears once it reads", async () => {
    boardStore.setState({ boards: [{ id: A, name: "Week 36" }, { id: C, name: "Ideas" }] });
    env.collected = { boards: [board(A, "Week 36", "Rent")], unreadable: [{ id: C, name: "Ideas" }] };

    await startAndChoose();
    expect(picked.read(picked.backups()[0]!).map((entry) => entry.id)).toEqual([A]);
    expect(backupStore.getState().warning).toMatch(/“Ideas” couldn't be read and isn't in any backup yet/);

    vi.setSystemTime(new Date(2026, 9, 16, 9, 41));
    edit(board(A, "Week 36", "Rent"), board(C, "Ideas", "Repaired"));
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(backupStore.getState().warning).toBeNull();
    expect(picked.read(picked.backups()[0]!).map((entry) => entry.id)).toEqual([A, C]);
  });
});

describe("findLatestBackupWith", () => {
  it("finds the newest backup holding the board, skipping unreadable files", async () => {
    const write = (at: Date, boards: BackupBoard[]) =>
      picked.files.set(backupFileName(at), JSON.stringify(serializeBackup(boards, at.toISOString())));
    write(new Date(2026, 9, 13, 9, 0), [board(C, "Ideas", "Oldest")]);
    write(new Date(2026, 9, 14, 9, 0), [board(C, "Ideas", "Newest with Ideas")]);
    write(new Date(2026, 9, 15, 9, 0), [board(A, "Week 36", "Rent")]);
    picked.files.set(backupFileName(new Date(2026, 9, 15, 10, 0)), "{ not json");
    env.idb.set("backupFolder", picked);
    stopWatching = auto.initAutoBackup();
    await settle();

    const found = await auto.findLatestBackupWith(C);
    expect(found?.name).toBe("boardkit-backup-2026-10-14-0900.json");
    expect(await auto.findLatestBackupWith("nowhere" as BoardId)).toBeNull();
  });

  it("finds nothing when the folder isn't allowed", async () => {
    picked.files.set(
      backupFileName(new Date(2026, 9, 14, 9, 0)),
      JSON.stringify(serializeBackup([board(C, "Ideas", "x")], "2026-10-14")),
    );
    picked.permission = "prompt";
    env.idb.set("backupFolder", picked);
    stopWatching = auto.initAutoBackup();
    await settle();
    picked.permission = "denied";

    expect(await auto.findLatestBackupWith(C)).toBeNull();
  });
});
