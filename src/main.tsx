import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { IconSprite } from "./components/IconSprite";
import { initAutoBackup } from "./features/board/autoBackup";
import { sweepUnusedImages } from "./store/imageStore";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

// Watches for changes to write automatic backups; a no-op where the browser
// cannot write to a folder.
initAutoBackup();

// Deletes background images no board uses any more (replaced or removed ones;
// see `sweepUnusedImages`). Off the critical path: nothing waits for it.
void sweepUnusedImages();

createRoot(container).render(
  <StrictMode>
    <IconSprite />
    <App />
  </StrictMode>,
);
