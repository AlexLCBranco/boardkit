// First: may write a test board to storage before the board store reads it.
import "./app/damageTestFromUrl";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { MovedNotice } from "./app/MovedNotice";
import { IconSprite } from "./components/IconSprite";
import { isHomeAddress } from "./domain/address";
import { initAutoBackup } from "./features/board/autoBackup";
import { sweepUnusedImages } from "./store/imageStore";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

// At an old address only the "moved" notice runs (see `domain/address.ts`):
// no automatic backups, which would write this address's stale boards into
// the folder the new address backs up to, and no image sweep, so nothing
// saved here is touched.
const atHome = isHomeAddress(window.location.hostname);

if (atHome) {
  // Watches for changes to write automatic backups; a no-op where the browser
  // cannot write to a folder.
  initAutoBackup();

  // Deletes background images no board uses any more (replaced or removed
  // ones; see `sweepUnusedImages`). Off the critical path: nothing waits for it.
  void sweepUnusedImages();
}

createRoot(container).render(
  <StrictMode>
    <IconSprite />
    {atHome ? <App /> : <MovedNotice />}
  </StrictMode>,
);
