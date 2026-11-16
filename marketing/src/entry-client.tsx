import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const rootEl = document.getElementById("root")!;
const hasPrerendered =
  rootEl.innerHTML.trim().length > 0 && !rootEl.innerHTML.includes("<!--APP_HTML-->");

if (hasPrerendered) {
  hydrateRoot(
    rootEl,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

(window as unknown as { __SMF_HYDRATED__?: boolean }).__SMF_HYDRATED__ = true;
