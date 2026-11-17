import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Cliente de Better Auth (spec 01 §5.1). La web solo llama a `/api/auth/*` a través de él.
 * Con cookies (`credentials: 'include'`): la API está en otro origen en producción.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  basePath: "/api/auth",
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: "include",
    // Resuelve `fetch` en cada llamada (no al crear el cliente): así lo intercepta MSW en los tests.
    customFetchImpl: (input, init) => fetch(input, init),
  },
});

/** Primera URL de vuelta tras verificar el email o entrar con Google (RN-01-12). */
export function appUrl(path = "/"): string {
  return `${window.location.origin}${path}`;
}
