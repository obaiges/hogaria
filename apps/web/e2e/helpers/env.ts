/** Puertos propios de los e2e (no chocan con `pnpm dev`: web 5173, API 3000). */
export const E2E_API_PORT = 3100;
export const E2E_WEB_PORT = 4173;

export const E2E_API_URL = `http://localhost:${E2E_API_PORT}`;
export const E2E_WEB_URL = `http://localhost:${E2E_WEB_PORT}`;
