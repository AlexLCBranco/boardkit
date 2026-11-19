# Boardkit — context for Claude

Read this first. It is loaded automatically at the start of every session.

## What this project is

A high-performance visual board engine: lists, cards, drag-and-drop,
instant renaming, and per-list visual customisation. It is **not** a
project-management app and not a Trello clone.

The owner is learning frontend development through this project. Explain
design decisions as you go. Prefer the approach that balances simplicity,
maintainability and scalability, and say why when several exist.

## Hard scope boundaries

Do **not** build, suggest building, or leave hooks for:

accounts, authentication, teams, comments, activity feeds, due dates,
checklists, notifications, calendar, integrations, attachments, AI features,
real-time collaboration.

If one of these seems necessary to finish a task, stop and ask instead.

## Priorities, in order

1. Excellent drag-and-drop
2. Smooth animation
3. Instant editing
4. Very clean code
5. Modular architecture
6. Stays smooth across many saved boards. Lists are short by design: never
   more than 50 cards in a list, and that is pushing it. Do not build list
   virtualisation or other big-list optimisations.
7. Easy to extend later

## How to work

- Planned work is in `FEATURE_BACKLOG.md`, shipped work in `BUILT.md`, ideas in
  `IDEAS.md` (see "Feature backlog, built list and ideas"). `PLAN.md` is history
  except its "In flight" claim table; `plans/` is history (reference specs).
- Every change must end with a running application. No half-built states left
  behind.
- Before writing code, say what you are building and why.
- Refactor when a change exposes a weak seam. Do not pre-build for work
  nobody has asked for.
- After finishing a piece of work, record anything architecturally
  significant in `ARCHITECTURE.md`.
- `PROJECT.md` is a plain-language snapshot the owner pastes into Claude
  chat. When a commit changes what's built, what's next, or the stack,
  update it (and its "Last updated" line) in the same commit. Keep it to
  about one screen, in plain language, with the same five sections every
  time: What it is, Stack, What works now, What's next, Open problems.
  Consistent sections let the owner spot what changed between versions.

Two agents work in this repo: Claude and Codex. Before editing, check
`git status` and `PLAN.md`. Claim an item in `PLAN.md` before starting it, so
both agents do not land in the same files.

## Non-negotiable technical rules

- **Layering.** Dependencies point one way:
  `app -> features -> components -> store -> domain -> styles`.
  `domain/` imports no React and no store. Ever.
- **State is normalised.** Flat `Record<id, entity>` plus separate arrays of
  ids for ordering. Never nest cards inside lists.
- **Subscribe narrowly.** A component reads the smallest slice of the store
  it can. A card re-render must never re-render its siblings.
- **Animate `transform` and `opacity` only.** Never animate `top`, `left`,
  `width`, `height` or `margin` — they force layout on every frame.
- **No hardcoded visual constants.** Every colour, spacing, radius, duration
  and easing curve comes from `src/styles/tokens.css`.
- **The board engine stays CSS Modules + CSS custom properties.** Lists,
  cards, drag choreography and the customisation popovers are hand-written
  against `tokens.css`, not Tailwind utility classes — those are the parts
  where runtime-set colours and drag-frame performance are hardest to get
  right through build-time classes, and that reasoning hasn't changed.
- **Everything else may use Tailwind + shadcn/ui.** shadcn/ui (Radix
  primitives) is installed for supporting chrome — dialogs, menus, tooltips,
  form controls, and anything else not on the drag-and-drop critical path.
  `tokens.css` is still the single source of visual truth either way:
  shadcn's semantic colours (`background`, `primary`, `border`, ...) are
  bridged to it in `src/styles/global.css`'s `@theme inline` block, never
  redefined as a second palette. Adding a shadcn component must not
  reintroduce a colour, radius or duration that bypasses that bridge.

## Stack

Vite, React 19, TypeScript (strict), Zustand, dnd-kit, CSS Modules, Tailwind
CSS v4 + shadcn/ui (supporting UI only), nanoid.

## Git

One commit per coherent change, on `main`, made only after `npm run build`
passes.

Subject line: a short imperative description. Body: a short bullet list of
what changed and why, not a file listing. Do not commit work in progress.

Bump `package.json`'s patch version (0.0.1 -> 0.0.2 -> ...) in every commit
that ships a user-visible change. It's shown on screen (`VersionBadge`) so
the deployed build can be checked against what's expected — skipping the
bump breaks that.

If a session goes wrong, the previous commit is the recovery point.

## Testing policy

Automate every check that can be automated: unit, integration, and end-to-end
with Playwright against the live site, using throwaway data the test creates
and deletes itself. Never hand the owner a manual checklist for something a
script can do. Manual steps only for what truly can't be automated (browser
permission prompts like folder pickers, and judging feel/usability). Keep
those to the minimum, say why each one can't be automated, and give one short
step at a time.

Tests and scripts run headless and close every browser window and process
they open, even on failure. After any run, no test window may be left open
on the owner's PC.

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # type-check + production build
npx tsc --noEmit # type-check only
```

Run `npm run build` before declaring a milestone complete.

## Feature backlog, built list and ideas (owner's standing workflow, updated 2026-11-15)

Three lists, never mixed:
- `FEATURE_BACKLOG.md`: planned work only. Nothing built is ever in it. It is the only list of planned work:
  "next", "queued" or "plan" sections in other docs are history, not the plan.
- `BUILT.md`: shipped work only, newest first.
- `IDEAS.md`: ideas the owner mentioned that are not planned (maybe later, maybe never). Never built from directly.

The owner's messages. Always read the lists from `main` on GitHub, never from your local checkout or branch
(Claude Code sessions run on a branch made at session start, so `git pull` there does NOT bring in backlog
items added later): run `git fetch origin main`, then read with `git show origin/main:FEATURE_BACKLOG.md`
(same for `BUILT.md` and `IDEAS.md`). Before building, merge `origin/main` into your branch.
- "build what's planned" / "build the backlog": build only the items under Ready in `FEATURE_BACKLOG.md` on
  `origin/main`. If there are none, say "Backlog is empty" and stop. Never build from `IDEAS.md`, `PLAN.md` or
  any other doc, and never fill gaps in a spec with your own defaults: ask.
- "what's planned" / "what's in the backlog": read `FEATURE_BACKLOG.md` only. List each item as
  `BD-n — title — one plain sentence on what changes in the app`. Build nothing.
- "what's built" / "what shipped" (maybe "since <date>" or "last N"): read `BUILT.md` only and list it.
- "ideas" / "what ideas": read `IDEAS.md` only and list it as `I-n — idea`.
- "next batch" / "build the backlog": every item, top to bottom. "next": the top item only. "build BD-n": that item only.
- "promote I-n": cut it from `IDEAS.md` and add it at the bottom of Ready in `FEATURE_BACKLOG.md` with the next free
  BD ID and a `From I-n` line. Build it only if the owner also asks for that.

Before building, list the IDs and titles you are about to build, in plain words.

When an item ships: in the same commit/PR as the code, cut it from `FEATURE_BACKLOG.md` and add it at the top of
`BUILT.md` under that day's `## <YYYY-MM-DD>` heading (one heading per day, newest first) as
`- BD-n — title (v<version>)`, then at most one plain sentence on what the owner sees. An item is never in both files. IDs are
never reused. Work shipped without a backlog item (a direct request, a fix) gets the same line without the ID:
`- title (v<version>)`. Housekeeping the owner can't see (handoff notes, pins, test-only or CI fixes, docs) goes under a
`### Internal` subheading at the bottom of that day, not in the main list. The same format is used in every one of
the owner's repos, so `gauntlet` can merge them into one `ALL_BUILT.md`.
Follow this file's other rules (branches, tests, version bump) as usual.

When the owner mentions something that isn't to be built now (an aside, "later", "someday", "maybe"), add it at the
bottom of `IDEAS.md` as `- I-n — the idea in plain words (YYYY-MM-DD)` and say so in the report. Never put an idea
in the backlog yourself.

If an item is unclear or blocked, don't guess: leave it in `FEATURE_BACKLOG.md` with a `Blocked:` note saying what's
missing, and continue with the next one. Don't add, rewrite or reorder backlog items yourself; only remove shipped
ones and add `Blocked:` notes. End with a short report: built / blocked / ideas added / what the owner must test by
hand (only what couldn't be automated). A pasted prompt overrides this section.

Guard: `scripts/check-lists.mjs` runs with the checks (before `npm test`) and fails if an ID is both planned and built, an
ID repeats, or package.json's version has no `BUILT.md` entry. Fix the lists, never the check.

## backlogkit formats (owner's rule, 2026-11-19; same text in every repo)

backlogkit (the owner's site that shows every repo's lists) reads these lines; keep them exact.
- Specs: every item in `FEATURE_BACKLOG.md` has, as the first line under its `### ID — title` heading,
  `**In short:** <one plain sentence: what the owner will see change, no code words>`. If nothing visible changes,
  say so ("Nothing changes on screen: ...").
- Blocked: a `Blocked:` line means the item waits on the owner. "build the backlog", "next batch" and "next" skip
  blocked items (they stay where they are) until the owner answers. An answer replaces the `Blocked:` line with
  `**Answered (YYYY-MM-DD):** <the question> → <the answer>`; from then on the item is built normally.
- Ideas: every idea in `IDEAS.md` ends with one reason tag saying why it isn't planned: `[why: waiting]` waits on
  something (a data source, a key or account, another feature, an outside event; the idea's text says which),
  `[why: decision]` needs the owner to decide something, `[why: too-big]` needs splitting first, `[why: later]` not
  important yet, `[why: never]` probably never. Tag only from what the owner said; if he gave no reason, leave the tag
  off (backlogkit shows it under "No reason yet"). The owner can also set it from backlogkit.
