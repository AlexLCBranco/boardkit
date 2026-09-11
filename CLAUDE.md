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
6. Performance at hundreds to thousands of cards
7. Easy to extend later

## How to work

- Work one milestone at a time. `PLAN.md` is the roadmap and the source of
  truth for what comes next. Never start a milestone before the previous one
  is marked complete there.
- Every milestone must end with a running application. No half-built states
  left behind.
- Before writing code, say what you are building and why it comes now.
- Refactor when a milestone exposes a weak seam. Do not pre-build for
  milestones that have not started.
- After finishing a milestone, update the status table in `PLAN.md` and note
  anything that changed in `ARCHITECTURE.md`.

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
- **Styling is CSS Modules + CSS custom properties.** Not Tailwind. This was
  decided deliberately: drag choreography and runtime-customisable colours
  are both awkward in build-time utility classes.

## Stack

Vite, React 19, TypeScript (strict), Zustand, dnd-kit, CSS Modules, nanoid.

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # type-check + production build
npx tsc --noEmit # type-check only
```

Run `npm run build` before declaring a milestone complete.
