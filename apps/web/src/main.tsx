import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";

import App from "./App";
import "./index.css";

// Enable MSW (Mock Service Worker) in development
async function initMocks() {
  if (import.meta.env.MODE === "development") {
    try {
      const { worker } = await import("./lib/api/mocks/browser");
      // A service worker that never activates would otherwise leave the page blank forever.
      // 20s, not 5s: registration + activation + the start() handshake can genuinely take this
      // long on a cold dev server or right after a dependency install, which isn't "never".
      await Promise.race([
        worker.start(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timed out after 20s")), 20000),
        ),
      ]);
    } catch (error) {
      // A broken mock layer must not stop the app from rendering.
      console.error("MSW failed to start; falling back to real API", error);
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

<<<<<<< HEAD
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
=======
initMocks().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
>>>>>>> main
