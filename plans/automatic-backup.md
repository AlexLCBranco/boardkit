# Plan: automatic backup to a folder, plus a backup reminder

A self-contained plan for one feature. It is **not** part of `PLAN.md`'s
queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #10): **both parts.**

## Why

Boards live only in this browser's `localStorage`. Clearing site data, a
Windows reinstall or a new computer loses them unless the owner remembered
"Export all boards…". Build as two commits, reminder first (smaller, and
works everywhere).

## Part 1: backup reminder (every browser)

### What the user gets

A small, quiet status line in the board switcher's menu (next to "Export
all boards…"), e.g.:

> Last backup: 9 days ago · **Back up now**

- "Back up now" runs the existing export (`exportBackup` in
  `src/features/board/backup.ts`).
- If there has never been a backup, or the last one is **older than 7 days**,
  a small dot appears on the board switcher so it's noticed without opening
  the menu. No pop-ups, no banners.
- When automatic backup (part 2) is on and working, the reminder shows
  "Backing up automatically · last saved 2 min ago" instead, with no dot.

### How it works

- Save `lastBackupAt` (a timestamp) in `localStorage`, **per browser**, not
  inside any board. Update it on every successful manual export and every
  successful automatic backup.
- "Older than 7 days" is a pure function in `domain/`, so it's testable.

## Part 2: automatic backup to a folder (Chrome and Edge)

### What the user gets

- The board menu gains **"Automatic backup…"**. Choosing a folder (ideally
  a synced one like OneDrive, Google Drive or Dropbox) turns it on.
- After that, a few seconds after changes stop, Boardkit writes a backup
  file there. It's the **same format as "Export all boards…"**, so the
  existing "Import boards…" restores it.
- Old files are cleaned up so the folder doesn't grow forever: keep the
  **last 20** backups.
- After a browser restart, Chrome requires one click to allow access again.
  Boardkit shows a clear **"Resume backups"** button (and the switcher dot)
  until it's clicked. Backups never stop silently.
- In Firefox and Safari, which can't write to folders, the option is hidden
  and only the part 1 reminder applies.

### How it works

- **File System Access API:** `showDirectoryPicker()` to choose the folder.
  Feature-detect it; hide the option where it's missing.
- **Remembering the folder:** the directory handle can be stored in
  IndexedDB (not `localStorage`). If
  [`backgrounds-and-themes.md`](./backgrounds-and-themes.md) part 3 has
  landed, reuse its IndexedDB module; otherwise create a small one in
  `src/store/` that part 3 can reuse later.
- **Permission on startup:** `handle.queryPermission({ mode: "readwrite" })`.
  If it returns `"prompt"`, show "Resume backups"; its click handler calls
  `requestPermission` (it must run inside a user click).
- **When to write:** debounce about 10 seconds after the last board change,
  and after board create, delete, rename, import and switch. Don't try to
  write on page close: the API is asynchronous and can't be relied on to
  finish.
- **Filenames:** `boardkit-backup-2026-09-19-1432.json` (sortable). Rotation
  deletes the oldest beyond 20, **only after a new backup has been written
  successfully**, so repeated failures never eat good old backups.
- **Writes are safe:** `createWritable()` writes to a temporary file and only
  replaces on `close()`, so a crash mid-write can't leave a half-written
  backup.
- **Images:** if part 3 of the backgrounds plan has landed, the backup
  includes images, same as the manual export.

### Important: don't back up a broken board as an empty one

`collectBoards()` in `src/features/board/backup.ts` currently replaces a
board that fails to load (`loadPersistedBoard` returns `null`) with
`createEmptyBoard()`. For a one-off manual export that's a quiet data loss.
For automatic backup with rotation it's worse: after 20 empty backups, every
good copy of that board would have been rotated away.

Change `collectBoards()` so a board that fails to load is **reported, not
replaced**. Automatic backup then skips writing that round and shows a
warning ("Board *Week 36* couldn't be read; backups paused so older copies
stay safe"). The manual export should warn too. This overlaps with
`PLAN.md` queued item 5 (shallow, destructive persistence validation);
coordinate if that's in flight.

### Status shown to the user

One place (the board menu, plus the switcher dot when attention is needed):

- On, working: "Backing up to *OneDrive/Boardkit* · last saved 2 min ago"
- Needs a click: "Backups paused · **Resume backups**"
- Folder gone or failing: "Backup folder not found · **Choose folder…**"
- Off: part 1's reminder.

Plus a **"Turn off automatic backup"** item.

## Out of scope

- Reading backups back automatically (restore stays the existing manual
  import).
- Syncing between computers (the synced folder does that).
- Any cloud service or account. Accounts and integrations are outside the
  project's scope boundaries.

## Done when

- The reminder shows the right "last backup" age in every browser, and the
  dot appears after 7 days or when a backup never happened.
- In Chrome/Edge: choosing a folder starts automatic backups; files appear
  after changes; the folder keeps at most 20; after a browser restart,
  "Resume backups" appears and works with one click.
- A backup file from the folder restores with "Import boards…".
- A board that fails to load pauses automatic backups with a warning and
  never overwrites older good backups; the manual export warns too.
- Firefox/Safari: no folder option, reminder works.
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped per
  commit.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
