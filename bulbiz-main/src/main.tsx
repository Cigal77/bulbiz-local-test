import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logError } from "./lib/error-logger";

let hasReloadedAfterChunkError = false;

function safeReload() {
  if (hasReloadedAfterChunkError) return;
  hasReloadedAfterChunkError = true;
  window.location.reload();
}

window.addEventListener("vite:preloadError", (event) => {
  console.error("[runtime] vite:preloadError", event);
  event.preventDefault();
  safeReload();
});

window.addEventListener("error", (event) => {
  const message = event?.error?.message || event.message || "";
  if (
    message.includes("ChunkLoadError") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Loading chunk")
  ) {
    console.error("[runtime] chunk error detected", message);
    safeReload();
  } else if (event?.error) {
    logError({
      error_message: event.error.message || message,
      error_stack: event.error.stack,
      function_name: "global_error_handler",
      source: "client",
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reasonText = String(event.reason?.message || event.reason || "");
  if (
    reasonText.includes("ChunkLoadError") ||
    reasonText.includes("Failed to fetch dynamically imported module") ||
    reasonText.includes("Loading chunk")
  ) {
    console.error("[runtime] chunk rejection detected", reasonText);
    event.preventDefault();
    safeReload();
  } else {
    logError({
      error_message: reasonText || "Unhandled promise rejection",
      error_stack: event.reason?.stack,
      function_name: "unhandled_rejection",
      source: "client",
    });
  }
});

createRoot(document.getElementById("root")!).render(<App />);

