import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { isNativeApp } from "./native/bridge";

if (typeof window !== "undefined" && "serviceWorker" in navigator && !isNativeApp()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
