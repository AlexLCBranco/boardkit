import { SearchIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import { MAX_SEARCH_RESULTS, searchBoards, type Excerpt, type SearchHit } from "../../domain/search";
import { loadSearchSources } from "../../store/searchSources";
import { useBoardId, useIsSearchOpen, useSetSearchOpen, useSwitchBoard } from "../../store/selectors";
import { formatCombo, parseCombo } from "../shortcuts/keys";
import { revealCard } from "./revealCard";

/**
 * Search across every board: the toolbar button plus the dialog it (and the
 * Ctrl/Cmd+K shortcut) opens. Read-only -- picking a result switches to that
 * board and shows the card; nothing is filtered, hidden or written.
 *
 * shadcn's `cmdk`-based command dialog, with its own fuzzy filter switched
 * off: matching is `domain/search.ts`, so the rules are ours and predictable.
 */
export function SearchDialog() {
  const isOpen = useIsSearchOpen();
  const setOpen = useSetSearchOpen();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Search all boards"
        title={`Search all boards (${formatCombo(parseCombo("mod+k")).join("+")})`}
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </Button>
      <CommandDialog
        open={isOpen}
        onOpenChange={setOpen}
        title="Search all boards"
        description="Search card titles and thots across every board."
      >
        {/* Radix mounts its content only while open, so this component's
            state -- the query, the loaded boards -- starts fresh every time
            the dialog opens, with no reset code. */}
        <SearchPanel onDone={() => setOpen(false)} />
      </CommandDialog>
    </>
  );
}

function SearchPanel({ onDone }: { readonly onDone: () => void }) {
  const activeBoardId = useBoardId();
  const switchBoard = useSwitchBoard();
  const [query, setQuery] = useState("");
  // Loaded once, on open -- not per keystroke. The dialog is modal, so the
  // board cannot change underneath it.
  const [sources] = useState(loadSearchSources);
  const hits = useMemo(() => searchBoards(sources, query), [sources, query]);
  const isSearching = query.trim() !== "";

  function open(hit: SearchHit) {
    onDone();
    if (hit.boardId !== activeBoardId) switchBoard(hit.boardId);
    revealCard(hit.cardId);
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search cards and thots on every board…" />
      <CommandList>
        <CommandEmpty>
          {isSearching ? "No cards found." : "Type to search every board's titles and thots."}
        </CommandEmpty>
        {hits.map((hit) => (
          <CommandItem
            key={`${hit.boardId}:${hit.cardId}`}
            value={`${hit.boardId}:${hit.cardId}`}
            onSelect={() => open(hit)}
            className="flex-col items-start gap-0.5"
          >
            <span className="flex w-full min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 font-medium">{hit.boardName}</span>
              <span className="text-muted-foreground">·</span>
              <span className="shrink-0 text-muted-foreground">{hit.listTitle}</span>
              <span className="text-muted-foreground">·</span>
              <span className="min-w-0 truncate">
                {hit.field === "title" ? <Highlighted excerpt={hit.excerpt} /> : hit.cardTitle}
              </span>
            </span>
            {hit.field !== "title" && (
              <span className="w-full truncate text-xs text-muted-foreground">
                <Highlighted excerpt={hit.excerpt} />
              </span>
            )}
          </CommandItem>
        ))}
        {hits.length === MAX_SEARCH_RESULTS && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Showing the first {MAX_SEARCH_RESULTS} matches — type more to narrow it down.
          </p>
        )}
      </CommandList>
    </Command>
  );
}

function Highlighted({ excerpt }: { readonly excerpt: Excerpt }) {
  return (
    <Fragment>
      {excerpt.before}
      <strong className="font-semibold text-foreground">{excerpt.match}</strong>
      {excerpt.after}
    </Fragment>
  );
}
