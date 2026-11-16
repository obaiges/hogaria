import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { QueryProvider } from "./app/providers/QueryProvider";
import { router } from "./app/router";
import { initTheme } from "./lib/theme";
import "./styles/index.css";

initTheme();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No se encontró el elemento root");

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>,
);
