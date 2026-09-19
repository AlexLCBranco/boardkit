# Plan: clickable links in thots

A small, self-contained plan for one feature. It is **not** part of
`PLAN.md`'s queue. Approved by the owner 2026-09-19 (see
[`feature-review.md`](./feature-review.md), #8).

## What the user gets

- A web address in a card's pregame or postgame thots shows as a link when
  the thot isn't being edited.
- Clicking the link opens it **in a new tab**; the board stays open.
- Clicking anywhere else in the thot still starts editing, as today. While
  editing, the raw text shows, exactly as typed.
- Long links are shortened for display, e.g. `ubereats.com/store/…`; the
  full address is in the tooltip and is what opens.
- Card **titles are not linkified.** Clicking a title renames it, and a link
  there would fight that. A pasted link in a title just shows as text.

## How it works

- **Finding links** is a pure function in a new `src/domain/links.ts` (no
  React): split a string into `text` and `link` segments. Match `http://` and
  `https://` URLs, plus bare `www.` addresses (opened with `https://`).
  Trailing punctuation (`.`, `,`, `)`, `!`, `?`) at the end of a match isn't
  part of the link: "see https://x.com." links `https://x.com`.
- **Safety:** only `http:` and `https:` become links, never `javascript:`,
  `data:` or anything else. Links get `target="_blank"` and
  `rel="noopener noreferrer"`. Build `<a>` elements from the segments with
  React; never use `dangerouslySetInnerHTML`.
- **Where:** thots are rendered by `InlineEditable` (`multiline`) in
  `CardItem.tsx`. Give `InlineEditable` an optional way to render its
  read-only view (e.g. a `renderDisplay` prop, or a `linkify` flag) rather
  than special-casing links inside it, so titles stay unchanged.
- **Clicks:** a click on an `<a>` must open the link **without** entering
  edit mode, and without starting a card drag. Stop that click from
  reaching the edit handler; check that the pointer sensor's 4px
  activation distance means a plain click on a link never starts a drag.
- **Keyboard:** links are reachable with Tab and open with Enter, like any
  link.
- **Look:** link colour and underline come from `tokens.css` (add a
  `--text-link` token if there isn't one), readable on every card tint.
  If #5 (custom colours) has landed, check against its contrast function.
- **Export:** PNG/PDF export and copy-as-image show links as styled text
  (they can't be clicked in an image, and that's fine).

## Done when

- `https://…`, `http://…` and `www.…` links in either thot are clickable
  and open in a new tab; trailing punctuation isn't included.
- Clicking non-link text in a thot still edits it; clicking a link doesn't.
- `javascript:` and other non-web schemes are never linkified.
- Titles are unchanged.
- `npm run build` passes; checked in the browser.
- `ARCHITECTURE.md` has an entry; `package.json` patch version bumped;
  one commit on `main`.
- Before starting, claim it in `PLAN.md`'s "In flight" table so Codex
  doesn't start on the same files.
