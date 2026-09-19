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

- `PLAN.md` lists what is queued, what is in flight, and what is deliberately
  not being built. Read it before starting; update it when something lands.
- `plans/` holds standalone, owner-approved feature plans, each built in its
  own chat. `plans/README.md` has the build order, status and how to start.
- Every change must end with a running application. No half-built states left
  behind.
- Before writing code, say what you are building and why.
- Refactor when a change exposes a weak seam. Do not pre-build for work
  nobody has asked for.
- After finishing a piece of work, record anything architecturally
  significant in `ARCHITECTURE.md`.

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

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # type-check + production build
npx tsc --noEmit # type-check only
```

Run `npm run build` before declaring a milestone complete.
