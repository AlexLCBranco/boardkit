import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { IconSprite } from "./components/IconSprite";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <IconSprite />
    <App />
  </StrictMode>,
);
