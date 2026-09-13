# Handoff

Snapshot for picking this project up cold. Written 2026-09-12.

## Read these first, in order

1. [`CLAUDE.md`](./CLAUDE.md) — scope boundaries, priorities, non-negotiable
   technical rules (layering, normalised state, animation constraints). Loads
   automatically for a Claude Code session in this folder.
2. [`PLAN.md`](./PLAN.md) — the live work queue: what is in flight, what is
   queued, and what is deliberately not being built. This is the source of
   truth for what comes next, not this file.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — what was actually built per
   milestone and why, including decisions that were later revised.
4. [`PERFORMANCE.md`](./PERFORMANCE.md) — the 1,000-card profiling baseline
   and why virtualisation was deferred.

## Where things stand right now

- The app is feature-complete against its original roadmap. Last commit:
  `6e65fd9` "Milestone 9: shadcn/ui, card rework, and multi-board support".
- The milestone system has since been retired — it was scaffolding for
  reaching a working base. `PLAN.md` is now a live work queue; the milestone
  history moved to `ARCHITECTURE.md`.
- Working tree is clean except one uncommitted change: `.gitignore` gained
  a `.vercel` entry (from a deploy attempt). Not committed yet — fold it
  into whatever the next commit is, or commit it standalone if nothing else
  is pending.
- Nothing is in progress. There is no half-finished state to recover from.
- `PLAN.md`'s queue holds findings from a code review, not yet started.
- **Two agents work in this repo:** Claude and Codex. Check `git status` and
  `PLAN.md`'s Owner column before editing anything.

## Starting the next session

> Read CLAUDE.md and PLAN.md. Confirm what is next, then start it.

"Next" means either an explicit request from the user, or the top unclaimed
item in `PLAN.md`'s queue. Anything under "Not being built" needs the user to
ask for it by name.

## Verifying the app still works

```bash
npm install
npm run build   # type-check + production build — must pass before any commit
npm run dev     # dev server on :5173
```

## Things a fresh agent would otherwise have to rediscover

- The board engine (`features/board/`, `components/` used by it) is
  hand-written CSS Modules against `src/styles/tokens.css`. Everything else
  may use Tailwind + shadcn/ui (`src/components/ui/`, 62 components
  installed). This split is deliberate, not partial migration — see
  `CLAUDE.md`'s styling rule and `ARCHITECTURE.md`'s milestone 9 notes.
- `tokens.css` is the *only* source of colour/spacing/radius/duration
  values. shadcn's semantic colours are bridged to it in
  `src/styles/global.css`'s `@theme inline` block — they are not a second
  palette.
- Each board's content and the board registry (`BoardId` + names + active
  board) are persisted separately in `localStorage`, under different keys.
  See `store/persistBoard.ts` vs `store/persistRegistry.ts`.
- Undo/redo (`domain/history.ts`) works by capturing before/after slice
  references from each action's own patch — not snapshots, not per-action
  inverse functions. It lives outside `BoardState` and is excluded from
  persistence.
- Cards have colour but no icon; lists have both. This was a deliberate
  removal (milestone 9), not an oversight — don't re-add a card icon picker
  without the user asking.
