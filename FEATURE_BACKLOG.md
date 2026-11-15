# Feature backlog — boardkit

Planned work only, nothing built. Shipped items move to `BUILT.md` (rules: CLAUDE.md, "Feature backlog and built list").
Specs are written here from Claude chat. Item IDs are BK-1, BK-2, ... (never reused).

## Ready

### BK-1 — Remove unused shadcn components (lowest priority)
What it changes: nothing visible; deletes the unused files in `src/components/ui/` (only `dropdown-menu` is used) and prunes their Radix packages. Less CSS weight and lint noise.
Spec: `PLAN.md`, "Queued", item 6.
