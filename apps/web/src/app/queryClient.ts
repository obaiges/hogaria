import { QueryClient } from "@tanstack/react-query";

/** Único `QueryClient` de la app: lo usan el provider y los loaders del router. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      networkMode: "always",
    },
  },
});
