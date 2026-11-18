import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { QueryProvider } from "./app/providers/QueryProvider";
import { router } from "./app/router";
import { UpdatePrompt } from "./app/UpdatePrompt";
import { ToastViewport } from "./components/ui/Toast";
import { listenBrowserConnection } from "./lib/realtime/connection-store";
import { initTheme } from "./lib/theme";
import "./styles/index.css";

initTheme();
listenBrowserConnection();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No se encontró el elemento root");

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
      <ToastViewport />
      {/* En desarrollo no hay service worker (vite-plugin-pwa solo lo genera en el build). */}
      {import.meta.env.PROD ? <UpdatePrompt /> : null}
    </QueryProvider>
  </StrictMode>,
);
