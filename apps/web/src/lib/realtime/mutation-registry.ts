/**
 * Registro de las mutaciones propias (spec 03, RN-03-16). El `apiClient` añade cada
 * `X-Client-Mutation-Id` **antes** de enviar la petición; el dispatcher ignora los
 * eventos que traen uno de estos ids, porque la pestaña ya aplicó el cambio.
 * Guarda los últimos `MAX_MUTATIONS` (cola circular + `Set`).
 */
export const MAX_MUTATIONS = 200;

export const mutationRegistry = new Set<string>();
const queue: string[] = [];

export function registerMutation(id: string): void {
  if (mutationRegistry.has(id)) return;
  mutationRegistry.add(id);
  queue.push(id);
  if (queue.length > MAX_MUTATIONS) {
    const oldest = queue.shift();
    if (oldest) mutationRegistry.delete(oldest);
  }
}

export function hasMutation(id: string | null | undefined): boolean {
  return typeof id === 'string' && mutationRegistry.has(id);
}

export function clearMutations(): void {
  mutationRegistry.clear();
  queue.length = 0;
}
