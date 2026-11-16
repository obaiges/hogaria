export const mutationRegistry = new Set<string>();
const MAX_MUTATIONS = 200;
const queue: string[] = [];

/** Registra un clientMutationId antes de enviar la mutación (stub hasta HOG-152). */
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
