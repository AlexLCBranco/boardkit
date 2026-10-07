import { isHomeAddress } from "../domain/address";
import { plantDamageTestBoard } from "../store/damageTest";

/**
 * Opening the app with `?damage-test` adds a throwaway board with one
 * damaged card and opens it, to try the recovery notice. The parameter is
 * then removed from the address, so a reload does not add another board.
 *
 * Imported first in `main.tsx`, for its side effect only: modules run in
 * import order, so this writes to storage before `boardStore` reads it.
 * Not at an old address, where the app does not run (`MovedNotice`).
 */
const url = new URL(window.location.href);
if (isHomeAddress(url.hostname) && url.searchParams.has("damage-test")) {
  plantDamageTestBoard();
  url.searchParams.delete("damage-test");
  window.history.replaceState(null, "", url);
}
