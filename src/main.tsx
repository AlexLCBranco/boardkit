import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { IconSprite } from "./components/IconSprite";
import { initAutoBackup } from "./features/board/autoBackup";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

// Watches for changes to write automatic backups; a no-op where the browser
// cannot write to a folder.
initAutoBackup();

createRoot(container).render(
  <StrictMode>
    <IconSprite />
    <App />
  </StrictMode>,
);
