# Feature backlog — boardkit

Planned work only, nothing built. Shipped items move to `BUILT.md` (rules: CLAUDE.md, "Feature backlog, built list and ideas").
Specs are written here from Claude chat. Item IDs are BD-1, BD-2, ... (never reused; BD is this repo's prefix, unique across the owner's repos).

## Ready

### BD-1 — Remove unused shadcn components (lowest priority)
**In short:** Nothing changes on screen: leftover unused code is removed.
What it changes: nothing visible; deletes the unused files in `src/components/ui/` (only `dropdown-menu` is used) and prunes their Radix packages. Less CSS weight and lint noise.
Spec: `PLAN.md`, "Queued", item 6.
