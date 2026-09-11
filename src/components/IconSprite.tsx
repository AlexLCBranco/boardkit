/**
 * Every icon the app can show, as inline `<symbol>` definitions. Mounted
 * once near the root; `Icon` then references one by id via `<use>`.
 *
 * An icon library was skipped on purpose: the set is fixed (`ICON_KEYS` in
 * `domain/types.ts`) and small, so a dependency, its bundle weight and its
 * network request would all be paying for hundreds of icons this app will
 * never use, to get the eight it does. A sprite of hand-drawn paths costs
 * nothing at runtime beyond the markup below.
 */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="icon-star" viewBox="0 0 24 24">
          <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
        </symbol>
        <symbol id="icon-flag" viewBox="0 0 24 24">
          <path d="M5 3v18M5 4h11l-3 4 3 4H5" />
        </symbol>
        <symbol id="icon-bug" viewBox="0 0 24 24">
          <circle cx="12" cy="13" r="5" />
          <path d="M9 8 7 5m8 3 2-3M7 13H3m18 0h-4M8 18l-2 3m12-3 2 3M12 8v10" />
        </symbol>
        <symbol id="icon-rocket" viewBox="0 0 24 24">
          <path d="M12 2c3 2 5 6 5 10 0 2-1 4-1 4H8s-1-2-1-4c0-4 2-8 5-10z" />
          <path d="M9 16l-3 5 4-2M15 16l3 5-4-2M11 9h2" />
        </symbol>
        <symbol id="icon-bolt" viewBox="0 0 24 24">
          <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
        </symbol>
        <symbol id="icon-fire" viewBox="0 0 24 24">
          <path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1 1 2 3 2 5a6 6 0 0 1-12 0c0-5 4-6 3-9 1 0 2-1 3-3z" />
        </symbol>
        <symbol id="icon-heart" viewBox="0 0 24 24">
          <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
        </symbol>
        <symbol id="icon-tag" viewBox="0 0 24 24">
          <path d="M20 12 12 20 4 12V4h8z" />
          <path d="M7.5 7.5h.01" />
        </symbol>
      </defs>
    </svg>
  );
}
